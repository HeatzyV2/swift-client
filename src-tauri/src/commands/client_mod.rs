//! Install / refresh the bundled Swift Client Fabric mod into an instance.
//! Always prefers the newest jar found (build/libs, cache, or SWIFT_CLIENT_MOD_JAR).

use std::cmp::Ordering;
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::error::{AppError, AppResult};
use crate::paths;

const MOD_FILE_NAME: &str = "swiftclient-mod.jar";
const LEGACY_NAMES: &[&str] = &["lightclient-mod.jar", "swiftclient.jar"];

#[derive(Debug, Clone, Serialize)]
pub struct ClientModStatus {
    pub installed: bool,
    pub path: Option<String>,
    pub cache_ready: bool,
    pub version_hint: Option<String>,
}

#[derive(Debug, Clone)]
struct Candidate {
    path: PathBuf,
    /// Parsed semver-ish tuple for ordering (major, minor, patch, extra).
    version: (u32, u32, u32, u32),
    modified: Option<std::time::SystemTime>,
    len: u64,
}

fn cache_path() -> PathBuf {
    paths::data_root().join("client").join(MOD_FILE_NAME)
}

fn mods_dir(instance_id: &str) -> PathBuf {
    paths::instance_game_dir(instance_id).join("mods")
}

fn installed_path(instance_id: &str) -> PathBuf {
    mods_dir(instance_id).join(MOD_FILE_NAME)
}

fn parse_version_str(raw: &str) -> (u32, u32, u32, u32) {
    let cleaned = raw
        .trim()
        .trim_start_matches('v')
        .split(|c: char| c == '-' || c == '+' || c == '_')
        .next()
        .unwrap_or(raw);
    let mut parts = cleaned.split('.').filter_map(|p| p.parse::<u32>().ok());
    (
        parts.next().unwrap_or(0),
        parts.next().unwrap_or(0),
        parts.next().unwrap_or(0),
        parts.next().unwrap_or(0),
    )
}

fn version_from_filename(path: &Path) -> Option<(u32, u32, u32, u32)> {
    let name = path.file_name()?.to_string_lossy();
    let stem = name.trim_end_matches(".jar");
    for prefix in ["swiftclient-mod-", "lightclient-mod-"] {
        if let Some(v) = stem.strip_prefix(prefix) {
            if !v.is_empty() && v.chars().next().is_some_and(|c| c.is_ascii_digit()) {
                return Some(parse_version_str(v));
            }
        }
    }
    None
}

fn version_from_fabric_json(path: &Path) -> Option<(u32, u32, u32, u32)> {
    let file = std::fs::File::open(path).ok()?;
    let mut zip = zip::ZipArchive::new(file).ok()?;
    let mut entry = zip.by_name("fabric.mod.json").ok()?;
    let mut body = String::new();
    std::io::Read::read_to_string(&mut entry, &mut body).ok()?;
    let v: serde_json::Value = serde_json::from_str(&body).ok()?;
    let ver = v.get("version")?.as_str()?;
    Some(parse_version_str(ver))
}

fn candidate_from(path: PathBuf) -> Option<Candidate> {
    if !path.is_file() {
        return None;
    }
    let meta = path.metadata().ok()?;
    let version = version_from_filename(&path)
        .or_else(|| version_from_fabric_json(&path))
        .unwrap_or((0, 0, 0, 0));
    Some(Candidate {
        path,
        version,
        modified: meta.modified().ok(),
        len: meta.len(),
    })
}

fn cmp_candidates(a: &Candidate, b: &Candidate) -> Ordering {
    match a.version.cmp(&b.version) {
        Ordering::Equal => {}
        other => return other,
    }
    match (a.modified, b.modified) {
        (Some(am), Some(bm)) => am.cmp(&bm),
        (Some(_), None) => Ordering::Greater,
        (None, Some(_)) => Ordering::Less,
        (None, None) => a.len.cmp(&b.len),
    }
}

fn newest_versioned_jar(dir: &Path) -> Option<Candidate> {
    let mut best: Option<Candidate> = None;
    let entries = std::fs::read_dir(dir).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();
        if !name.ends_with(".jar") || name.contains("sources") || name.contains("-dev") {
            continue;
        }
        let stem = name.trim_end_matches(".jar");
        if !(stem.starts_with("swiftclient-mod") || stem.starts_with("lightclient-mod")) {
            continue;
        }
        let Some(c) = candidate_from(path) else { continue };
        if best.as_ref().map(|b| cmp_candidates(&c, b).is_gt()).unwrap_or(true) {
            best = Some(c);
        }
    }
    best
}

fn discover_best_jar() -> Option<Candidate> {
    let mut best: Option<Candidate> = None;
    let mut consider = |c: Candidate| {
        if best.as_ref().map(|b| cmp_candidates(&c, b).is_gt()).unwrap_or(true) {
            best = Some(c);
        }
    };

    if let Ok(custom) = std::env::var("SWIFT_CLIENT_MOD_JAR") {
        let p = PathBuf::from(custom.trim());
        if let Some(c) = candidate_from(p) {
            // Explicit override always wins.
            return Some(c);
        }
    }

    if let Some(c) = candidate_from(cache_path()) {
        consider(c);
    }

    let candidates = [
        PathBuf::from(r"D:\swiftclient-mod\build\libs"),
        PathBuf::from(r"C:\Users\Zorat\Documents\Swift Client\swiftclient-mod\build\libs"),
        std::env::current_dir()
            .ok()
            .map(|d| d.join("..").join("swiftclient-mod").join("build").join("libs"))
            .unwrap_or_default(),
        // Also scan launcher-adjacent paths used during packaging.
        std::env::current_exe()
            .ok()
            .and_then(|e| e.parent().map(|p| p.join("mods")))
            .unwrap_or_default(),
        paths::data_root().join("client"),
    ];
    for dir in candidates {
        if let Some(c) = newest_versioned_jar(&dir) {
            consider(c);
        }
        // Unversioned swiftclient-mod.jar sitting in that folder.
        if let Some(c) = candidate_from(dir.join(MOD_FILE_NAME)) {
            consider(c);
        }
    }

    best
}

fn seed_cache_from(source: &Path) -> AppResult<PathBuf> {
    let cache = cache_path();
    if let Some(parent) = cache.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("client mod cache dir: {e}"))?;
    }
    if source.canonicalize().ok().as_ref() == cache.canonicalize().ok().as_ref() {
        return Ok(cache);
    }
    let refresh = match (source.metadata(), cache.metadata()) {
        (Ok(src), Ok(dst)) => {
            let src_ver = candidate_from(source.to_path_buf()).map(|c| c.version);
            let dst_ver = candidate_from(cache.clone()).map(|c| c.version);
            match (src_ver, dst_ver) {
                (Some(sv), Some(dv)) if sv != dv => sv > dv,
                _ => {
                    let src_t = src.modified().ok();
                    let dst_t = dst.modified().ok();
                    match (src_t, dst_t) {
                        (Some(s), Some(d)) => s > d || src.len() != dst.len(),
                        _ => src.len() != dst.len(),
                    }
                }
            }
        }
        (Ok(_), Err(_)) => true,
        _ => false,
    };
    if refresh {
        std::fs::copy(source, &cache).map_err(|e| format!("cache client mod: {e}"))?;
        log::info!(
            "cached Swift client mod {} from {}",
            jar_version_hint(source).unwrap_or_else(|| "?".into()),
            source.display()
        );
    }
    Ok(cache)
}

fn jar_version_hint(path: &Path) -> Option<String> {
    if let Some((a, b, c, d)) = version_from_filename(path) {
        return Some(if d == 0 {
            format!("{a}.{b}.{c}")
        } else {
            format!("{a}.{b}.{c}.{d}")
        });
    }
    let file = std::fs::File::open(path).ok()?;
    let mut zip = zip::ZipArchive::new(file).ok()?;
    let mut entry = zip.by_name("fabric.mod.json").ok()?;
    let mut body = String::new();
    std::io::Read::read_to_string(&mut entry, &mut body).ok()?;
    let v: serde_json::Value = serde_json::from_str(&body).ok()?;
    v.get("version")
        .and_then(|x| x.as_str())
        .map(String::from)
}

fn purge_legacy(mods: &Path) {
    let Ok(entries) = std::fs::read_dir(mods) else { return };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_lowercase();
        let is_legacy = LEGACY_NAMES.iter().any(|n| name == *n)
            || ((name.contains("lightclient") || name.contains("swiftclient"))
                && name.ends_with(".jar")
                && name != MOD_FILE_NAME);
        if is_legacy {
            let _ = std::fs::remove_file(entry.path());
        }
    }
}

/// Copy the newest Swift client mod into an instance's `minecraft/mods` folder.
pub fn ensure_installed(instance_id: &str) -> AppResult<ClientModStatus> {
    let Some(best) = discover_best_jar() else {
        return Ok(ClientModStatus {
            installed: installed_path(instance_id).is_file(),
            path: installed_path(instance_id)
                .is_file()
                .then(|| installed_path(instance_id).to_string_lossy().into_owned()),
            cache_ready: false,
            version_hint: None,
        });
    };

    let cache = seed_cache_from(&best.path)?;

    let mods = mods_dir(instance_id);
    std::fs::create_dir_all(&mods).map_err(|e| format!("mods dir: {e}"))?;
    purge_legacy(&mods);

    let dest = installed_path(instance_id);
    let needs_copy = match (candidate_from(cache.clone()), candidate_from(dest.clone())) {
        (Some(src), Some(dst)) => cmp_candidates(&src, &dst).is_gt() || src.len != dst.len,
        (Some(_), None) => true,
        _ => true,
    };
    if needs_copy {
        std::fs::copy(&cache, &dest).map_err(|e| format!("install client mod: {e}"))?;
        let fabric = paths::instance_game_dir(instance_id).join(".fabric");
        if fabric.is_dir() {
            let _ = std::fs::remove_dir_all(fabric);
        }
        log::info!(
            "installed {MOD_FILE_NAME} ({}) into instance {instance_id}",
            jar_version_hint(&cache).unwrap_or_else(|| "?".into())
        );
    }

    Ok(ClientModStatus {
        installed: dest.is_file(),
        path: Some(dest.to_string_lossy().into_owned()),
        cache_ready: cache.is_file(),
        version_hint: jar_version_hint(&cache),
    })
}

pub fn status(instance_id: &str) -> ClientModStatus {
    let dest = installed_path(instance_id);
    let cache = cache_path();
    ClientModStatus {
        installed: dest.is_file(),
        path: dest
            .is_file()
            .then(|| dest.to_string_lossy().into_owned()),
        cache_ready: cache.is_file() || discover_best_jar().is_some(),
        version_hint: jar_version_hint(if dest.is_file() { &dest } else { &cache }),
    }
}

pub fn has_essential(instance_id: &str) -> bool {
    let dir = mods_dir(instance_id);
    let Ok(entries) = std::fs::read_dir(dir) else {
        return false;
    };
    entries.flatten().any(|e| {
        let name = e.file_name().to_string_lossy().to_lowercase();
        name.ends_with(".jar")
            && !name.ends_with(".jar.disabled")
            && (name.contains("essential") || name.starts_with("essential-"))
    })
}

pub fn has_client_mod(instance_id: &str) -> bool {
    installed_path(instance_id).is_file()
}

#[derive(Debug, Clone, Serialize)]
pub struct PrelaunchHint {
    /// Stable key for i18n: `essential`, `missing_swift_mod`, `recent_crash`.
    pub kind: String,
}

pub fn prelaunch_hints(instance_id: &str) -> Vec<PrelaunchHint> {
    let mut out = Vec::new();
    if has_essential(instance_id) {
        out.push(PrelaunchHint {
            kind: "essential".into(),
        });
    }
    if !has_client_mod(instance_id) && discover_best_jar().is_none() {
        out.push(PrelaunchHint {
            kind: "missing_swift_mod".into(),
        });
    }
    if recent_crash(instance_id) {
        out.push(PrelaunchHint {
            kind: "recent_crash".into(),
        });
    }
    out
}

fn recent_crash(instance_id: &str) -> bool {
    let dir = paths::instance_game_dir(instance_id).join("crash-reports");
    let Ok(entries) = std::fs::read_dir(dir) else {
        return false;
    };
    let cutoff = std::time::SystemTime::now() - std::time::Duration::from_secs(60 * 60 * 24 * 3);
    entries.flatten().any(|e| {
        e.metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .map(|t| t > cutoff)
            .unwrap_or(false)
    })
}

#[tauri::command]
pub async fn ensure_client_mod(instance_id: String) -> AppResult<ClientModStatus> {
    crate::blocking(move || ensure_installed(&instance_id)).await
}

#[tauri::command]
pub async fn client_mod_status(instance_id: String) -> AppResult<ClientModStatus> {
    crate::blocking(move || Ok(status(&instance_id))).await
}

#[tauri::command]
pub async fn prelaunch_checks(instance_id: String) -> AppResult<Vec<PrelaunchHint>> {
    crate::blocking(move || Ok(prelaunch_hints(&instance_id))).await
}

#[tauri::command]
pub async fn import_client_mod_jar(path: String) -> AppResult<ClientModStatus> {
    crate::blocking(move || {
        let src = PathBuf::from(path);
        if !src.is_file() {
            return Err(AppError::invalid("mod jar not found"));
        }
        let cache = seed_cache_from(&src)?;
        Ok(ClientModStatus {
            installed: false,
            path: None,
            cache_ready: cache.is_file(),
            version_hint: jar_version_hint(&cache),
        })
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::{cmp_candidates, parse_version_str, Candidate};
    use std::path::PathBuf;

    #[test]
    fn newer_semver_wins() {
        let older = Candidate {
            path: PathBuf::from("a"),
            version: parse_version_str("1.0.7"),
            modified: None,
            len: 1,
        };
        let newer = Candidate {
            path: PathBuf::from("b"),
            version: parse_version_str("1.0.9"),
            modified: None,
            len: 1,
        };
        assert!(cmp_candidates(&newer, &older).is_gt());
    }
}
