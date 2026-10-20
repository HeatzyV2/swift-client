//! Install / refresh the Swift Client Fabric mod in Swift instances.
//! The jar ships inside the launcher (bundled resource). A newer one published on the mod's GitHub
//! Releases is fetched in the background (see `spawn_background_update`) and, throttled, before a launch
//! (`refresh_from_releases`); SWIFT_CLIENT_MOD_JAR or a sibling `swiftclient-mod/build/libs` (development)
//! can provide one too. The newest jar wins, unless the player picked a channel ("local" never downloads)
//! or pinned an older version to roll back (`mod_use_version`).

use std::cmp::Ordering;
use std::path::{Path, PathBuf};

use std::sync::atomic::{AtomicI64, Ordering as AtomicOrdering};
use std::sync::Mutex;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::error::{AppError, AppResult};
use crate::paths;

const MOD_FILE_NAME: &str = "swiftclient-mod.jar";
/// What a Swift instance runs. Keep in sync with the mod (gradle.properties / fabric.mod.json).
pub const SWIFT_MC_VERSION: &str = "26.2";
pub const SWIFT_FABRIC_LOADER: &str = "0.19.5";
/// Fabric API on Modrinth, required by the mod.
const FABRIC_API_PROJECT: &str = "P7dR8mSH";

/// Launcher resource folder (set at startup): the installer puts the bundled mod jar in `resources/`.
static RESOURCE_DIR: std::sync::OnceLock<PathBuf> = std::sync::OnceLock::new();

pub fn set_resource_dir(dir: PathBuf) {
    let _ = RESOURCE_DIR.set(dir);
}
const LEGACY_NAMES: &[&str] = &["swiftclient.jar"];
/// Releases of the mod, newest first: more than the latest one, so the beta channel can see pre-releases.
const MOD_RELEASES_API: &str = "https://api.github.com/repos/HeatzyV2/swiftclient-mod/releases?per_page=12";
/// How many downloaded versions stay on disk, for rolling back.
const KEEP_VERSIONS: usize = 3;
/// Launching only looks for an update this often, so the check never slows the game down.
const LAUNCH_CHECK_EVERY_SECS: i64 = 30 * 60;
/// The background updater looks again this often while the launcher stays open.
const BACKGROUND_CHECK_EVERY: Duration = Duration::from_secs(3 * 60 * 60);

static LAST_LAUNCH_CHECK: AtomicI64 = AtomicI64::new(0);
/// What the last network check found, so the UI can show it without asking GitHub again.
static LATEST_SEEN: Mutex<Option<ReleaseAsset>> = Mutex::new(None);

/// One downloadable build of the mod, picked from the GitHub releases.
#[derive(Debug, Clone, Serialize)]
pub struct ReleaseAsset {
    pub name: String,
    pub url: String,
    /// "2.4.0" or "2.4.0-beta.1".
    pub version: String,
    pub prerelease: bool,
    pub digest: Option<String>,
    pub size: u64,
}

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
    let v = stem.strip_prefix("swiftclient-mod-")?;
    v.chars().next().is_some_and(|c| c.is_ascii_digit()).then(|| parse_version_str(v))
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
        if !stem.starts_with("swiftclient-mod") {
            continue;
        }
        let Some(c) = candidate_from(path) else { continue };
        if best.as_ref().map(|b| cmp_candidates(&c, b).is_gt()).unwrap_or(true) {
            best = Some(c);
        }
    }
    best
}

/// Orders version strings like semver: the numbers, then a release beats its own pre-release, then the
/// pre-release number ("2.4.0-beta.2" is newer than "2.4.0-beta.1").
pub fn version_key(raw: &str) -> (u32, u32, u32, u32, u32) {
    let t = raw.trim().trim_start_matches('v');
    let (core, pre) = match t.split_once('-') {
        Some((c, p)) => (c, Some(p)),
        None => (t, None),
    };
    let core = core.split('+').next().unwrap_or(core);
    let mut nums = core.split('.').filter_map(|p| p.parse::<u32>().ok());
    let (a, b, c) = (nums.next().unwrap_or(0), nums.next().unwrap_or(0), nums.next().unwrap_or(0));
    match pre {
        None => (a, b, c, 1, 0),
        Some(p) => {
            let n = p
                .split(|ch: char| !ch.is_ascii_digit())
                .find_map(|part| part.parse::<u32>().ok())
                .unwrap_or(0);
            (a, b, c, 0, n)
        }
    }
}

pub fn is_newer_version(local: &str, remote: &str) -> bool {
    version_key(remote) > version_key(local)
}

/// "2.4.0-beta.1" out of `swiftclient-mod-2.4.0-beta.1.jar`.
fn version_string_from_filename(path: &Path) -> Option<String> {
    let name = path.file_name()?.to_string_lossy();
    let stem = name.trim_end_matches(".jar");
    let v = stem.strip_prefix("swiftclient-mod-")?;
    if v.chars().next().is_some_and(|c| c.is_ascii_digit()) {
        return Some(v.to_string());
    }
    None
}

fn version_string_from_fabric_json(path: &Path) -> Option<String> {
    let file = std::fs::File::open(path).ok()?;
    let mut zip = zip::ZipArchive::new(file).ok()?;
    let mut entry = zip.by_name("fabric.mod.json").ok()?;
    let mut body = String::new();
    std::io::Read::read_to_string(&mut entry, &mut body).ok()?;
    let v: serde_json::Value = serde_json::from_str(&body).ok()?;
    v.get("version").and_then(|x| x.as_str()).map(String::from)
}

fn jar_version_string(path: &Path) -> Option<String> {
    version_string_from_filename(path).or_else(|| version_string_from_fabric_json(path))
}

fn current_settings() -> crate::models::Settings {
    crate::commands::settings::load().unwrap_or_default()
}

fn pinned_version() -> Option<String> {
    current_settings().mod_pinned.filter(|v| !v.trim().is_empty())
}

/// Every folder that can hold a copy of the mod: the launcher's own, the bundled resources and local builds
/// of the `swiftclient-mod` repository found next to the launcher sources.
fn candidate_dirs() -> Vec<PathBuf> {
    let mut candidates: Vec<PathBuf> = vec![
        // Shipped with the launcher.
        RESOURCE_DIR.get().map(|d| d.join("resources")).unwrap_or_default(),
        // Also scan launcher-adjacent paths used during packaging.
        std::env::current_exe()
            .ok()
            .and_then(|e| e.parent().map(|p| p.join("mods")))
            .unwrap_or_default(),
        paths::data_root().join("client"),
    ];
    // Local builds of the mod: explicit folder, then the repository found next to the launcher sources
    // (from the working directory and from the executable, whichever depth `tauri dev` or a packaged
    // build runs at).
    if let Ok(dir) = std::env::var("SWIFT_MOD_BUILD_DIR") {
        candidates.push(PathBuf::from(dir.trim()));
    }
    let starts = [std::env::current_dir().ok(), std::env::current_exe().ok().and_then(|e| e.parent().map(Path::to_path_buf))];
    for start in starts.into_iter().flatten() {
        for ancestor in start.ancestors().take(8) {
            let libs = ancestor.join("swiftclient-mod").join("build").join("libs");
            if libs.is_dir() && !candidates.contains(&libs) {
                candidates.push(libs);
            }
        }
    }
    candidates
}

/// Every mod jar the launcher can see, with its version string.
fn all_jars() -> Vec<(String, Candidate)> {
    let mut out = Vec::new();
    for dir in candidate_dirs() {
        let Ok(entries) = std::fs::read_dir(&dir) else { continue };
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().into_owned();
            let stem = name.trim_end_matches(".jar");
            if !name.ends_with(".jar") || name.contains("sources") || name.contains("-dev") {
                continue;
            }
            if !stem.starts_with("swiftclient-mod") {
                continue;
            }
            let path = entry.path();
            if let (Some(version), Some(c)) = (jar_version_string(&path), candidate_from(path)) {
                out.push((version, c));
            }
        }
    }
    out
}

fn find_version(version: &str) -> Option<Candidate> {
    all_jars()
        .into_iter()
        .filter(|(v, _)| v == version)
        .map(|(_, c)| c)
        .max_by(cmp_candidates)
}

fn discover_best_jar() -> Option<Candidate> {
    if let Ok(custom) = std::env::var("SWIFT_CLIENT_MOD_JAR") {
        let p = PathBuf::from(custom.trim());
        if let Some(c) = candidate_from(p) {
            // Explicit override always wins.
            return Some(c);
        }
    }

    // A version the player rolled back to beats "newest". If its file is gone, fall back to the newest
    // rather than installing nothing.
    if let Some(pin) = pinned_version() {
        if let Some(c) = find_version(&pin) {
            return Some(c);
        }
    }

    let mut best: Option<Candidate> = None;
    let mut consider = |c: Candidate| {
        if best.as_ref().map(|b| cmp_candidates(&c, b).is_gt()).unwrap_or(true) {
            best = Some(c);
        }
    };

    if let Some(c) = candidate_from(cache_path()) {
        consider(c);
    }

    for dir in candidate_dirs() {
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

/// Does this jar target the Minecraft version Swift instances run? (A release for the next Minecraft
/// version must not land in current instances.)
fn targets_swift_minecraft(path: &Path) -> bool {
    let Ok(file) = std::fs::File::open(path) else { return false };
    let Ok(mut zip) = zip::ZipArchive::new(file) else { return false };
    let Ok(mut entry) = zip.by_name("fabric.mod.json") else { return false };
    let mut body = String::new();
    if std::io::Read::read_to_string(&mut entry, &mut body).is_err() {
        return false;
    }
    let Ok(v) = serde_json::from_str::<serde_json::Value>(&body) else { return false };
    v.get("id").and_then(|x| x.as_str()) == Some("swiftclient")
        && v
            .pointer("/depends/minecraft")
            .and_then(|x| x.as_str())
            .is_some_and(|range| range.contains(SWIFT_MC_VERSION))
}

fn is_mod_jar_name(name: &str) -> bool {
    name.starts_with("swiftclient-mod-") && name.ends_with(".jar") && !name.contains("sources") && !name.contains("-dev")
}

/// The newest downloadable build for a channel: "stable" ignores pre-releases, "beta" takes them too.
pub fn pick_release(releases: &serde_json::Value, channel: &str) -> Option<ReleaseAsset> {
    let mut best: Option<ReleaseAsset> = None;
    for rel in releases.as_array()? {
        if rel["draft"].as_bool().unwrap_or(false) {
            continue;
        }
        let prerelease = rel["prerelease"].as_bool().unwrap_or(false);
        if prerelease && channel != "beta" {
            continue;
        }
        let Some(asset) = rel["assets"]
            .as_array()
            .and_then(|assets| assets.iter().find(|a| a["name"].as_str().is_some_and(is_mod_jar_name)))
        else {
            continue;
        };
        let (Some(name), Some(url)) = (asset["name"].as_str(), asset["browser_download_url"].as_str()) else { continue };
        let Some(version) = version_string_from_filename(Path::new(name)) else { continue };
        let candidate = ReleaseAsset {
            name: name.to_string(),
            url: url.to_string(),
            version,
            prerelease,
            digest: asset["digest"].as_str().and_then(|d| d.strip_prefix("sha256:")).map(str::to_lowercase),
            size: asset["size"].as_u64().unwrap_or(0),
        };
        let newer = best.as_ref().map(|b| version_key(&candidate.version) > version_key(&b.version)).unwrap_or(true);
        if newer {
            best = Some(candidate);
        }
    }
    best
}

fn unix_now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// Is it time for the launch path to look for an update again?
fn launch_check_due(now: i64, last: i64) -> bool {
    now - last >= LAUNCH_CHECK_EVERY_SECS
}

/// Asks GitHub for the newest build of `channel` and remembers it.
async fn fetch_latest(channel: &str, timeout: Duration) -> Result<Option<ReleaseAsset>, String> {
    let http = reqwest::Client::builder()
        .user_agent(concat!("SwiftClient/", env!("CARGO_PKG_VERSION")))
        .timeout(timeout)
        .build()
        .map_err(|e| e.to_string())?;
    let releases: serde_json::Value = http
        .get(MOD_RELEASES_API)
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
    let picked = pick_release(&releases, channel);
    if let Ok(mut seen) = LATEST_SEEN.lock() {
        *seen = picked.clone();
    }
    Ok(picked)
}

/// Fetches the newest build of `channel` when it is newer than every jar the launcher already has, with
/// progress events when `app` is given. The jar lands in the launcher data folder, where
/// `discover_best_jar` picks it up. Returns the new file and its version.
async fn download_newer(channel: &str, app: Option<&AppHandle>, timeout: Duration) -> Result<Option<(PathBuf, String)>, String> {
    let Some(remote) = fetch_latest(channel, timeout).await? else { return Ok(None) };
    let current = crate::blocking(|| Ok(discover_best_jar().and_then(|c| jar_version_string(&c.path))))
        .await
        .map_err(|e| e.to_string())?;
    if current.as_deref().is_some_and(|v| !is_newer_version(v, &remote.version)) {
        return Ok(None);
    }

    let http = reqwest::Client::builder()
        .user_agent(concat!("SwiftClient/", env!("CARGO_PKG_VERSION")))
        .timeout(Duration::from_secs(180))
        .build()
        .map_err(|e| e.to_string())?;
    let mut response = http.get(&remote.url).send().await.map_err(|e| e.to_string())?.error_for_status().map_err(|e| e.to_string())?;
    let total = response.content_length().unwrap_or(remote.size);
    let mut bytes: Vec<u8> = Vec::with_capacity(total as usize);
    let mut last_emit = std::time::Instant::now();
    while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
        bytes.extend_from_slice(&chunk);
        if let Some(app) = app {
            if last_emit.elapsed() >= Duration::from_millis(120) {
                last_emit = std::time::Instant::now();
                let _ = app.emit(
                    "mod-update-progress",
                    serde_json::json!({ "received": bytes.len(), "total": total, "version": remote.version }),
                );
            }
        }
    }
    if let Some(app) = app {
        let _ = app.emit("mod-update-progress", serde_json::json!({ "received": bytes.len(), "total": bytes.len(), "version": remote.version }));
    }

    if let Some(expected) = &remote.digest {
        use sha2::{Digest, Sha256};
        let actual: String = Sha256::digest(&bytes).iter().map(|b| format!("{b:02x}")).collect();
        if &actual != expected {
            return Err(format!("{}: checksum mismatch, download ignored", remote.name));
        }
    }
    let dir = paths::data_root().join("client");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let part = dir.join(format!("{}.part", remote.name));
    std::fs::write(&part, &bytes).map_err(|e| e.to_string())?;
    if !targets_swift_minecraft(&part) {
        let _ = std::fs::remove_file(&part);
        return Err(format!("{} is not a Swift Client mod for Minecraft {SWIFT_MC_VERSION}, ignored", remote.name));
    }
    let dest = dir.join(&remote.name);
    std::fs::rename(&part, &dest).map_err(|e| e.to_string())?;
    prune_versions(&dir, KEEP_VERSIONS, pinned_version().as_deref());
    Ok(Some((dest, remote.version)))
}

/// Which of `versions` to delete so that only the `keep` newest remain (the protected one always stays).
fn versions_to_prune(versions: &[String], keep: usize, protect: Option<&str>) -> Vec<String> {
    let mut sorted: Vec<&String> = versions.iter().collect();
    sorted.sort_by_key(|v| std::cmp::Reverse(version_key(v)));
    sorted.into_iter().skip(keep).filter(|v| Some(v.as_str()) != protect).cloned().collect()
}

fn prune_versions(dir: &Path, keep: usize, protect: Option<&str>) {
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    let mut jars: Vec<(String, PathBuf)> = Vec::new();
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if is_mod_jar_name(&name) {
            if let Some(v) = version_string_from_filename(&entry.path()) {
                jars.push((v, entry.path()));
            }
        }
    }
    let versions: Vec<String> = jars.iter().map(|(v, _)| v.clone()).collect();
    for old in versions_to_prune(&versions, keep, protect) {
        for (v, path) in &jars {
            if *v == old {
                let _ = std::fs::remove_file(path);
            }
        }
    }
}

/// Before a launch: fetch a newer mod only when it is due (every 30 minutes at most) and quickly, so a slow
/// or missing network never holds the game back. Never fails the launch.
pub async fn refresh_from_releases() {
    if std::env::var("SWIFT_CLIENT_MOD_JAR").is_ok() {
        return;
    }
    let settings = current_settings();
    if settings.mod_channel == "local" || settings.mod_pinned.is_some() || !settings.mod_auto_update {
        return;
    }
    let now = unix_now();
    if !launch_check_due(now, LAST_LAUNCH_CHECK.load(AtomicOrdering::Relaxed)) {
        return;
    }
    LAST_LAUNCH_CHECK.store(now, AtomicOrdering::Relaxed);
    match download_newer(&settings.mod_channel, None, Duration::from_secs(4)).await {
        Ok(Some((path, version))) => log::info!("downloaded Swift client mod {version} ({})", path.display()),
        Ok(None) => {}
        Err(e) => log::warn!("Swift client mod update check: {e}"),
    }
}

/// Keeps the mod fresh while the launcher is open: a first look shortly after start-up, then every few
/// hours. Tells the UI through `mod-update-progress` and `mod-update-done`.
pub fn spawn_background_update(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_secs(8)).await;
        loop {
            let settings = current_settings();
            if settings.mod_auto_update && settings.mod_channel != "local" && settings.mod_pinned.is_none() && std::env::var("SWIFT_CLIENT_MOD_JAR").is_err() {
                match download_newer(&settings.mod_channel, Some(&app), Duration::from_secs(10)).await {
                    Ok(Some((_, version))) => {
                        log::info!("Swift client mod updated in the background to {version}");
                        let _ = app.emit("mod-update-done", serde_json::json!({ "version": version }));
                    }
                    Ok(None) => {}
                    Err(e) => log::warn!("Swift client mod background update: {e}"),
                }
            }
            tokio::time::sleep(BACKGROUND_CHECK_EVERY).await;
        }
    });
}

#[derive(Debug, Clone, Serialize)]
pub struct ModVersion {
    pub version: String,
    /// "cache" (downloaded), "bundled" (shipped with the launcher) or "local" (a build next to the launcher sources).
    pub source: String,
    pub size: u64,
    /// The one that will be installed at the next launch.
    pub current: bool,
    pub pinned: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct ModUpdateStatus {
    /// Version that will be installed at the next launch.
    pub installed: Option<String>,
    pub latest: Option<String>,
    pub latest_prerelease: bool,
    pub update_available: bool,
    pub channel: String,
    pub pinned: Option<String>,
    pub auto_update: bool,
    /// The last network check failed.
    pub offline: bool,
    pub versions: Vec<ModVersion>,
}

fn classify_source(path: &Path) -> &'static str {
    let client = paths::data_root().join("client");
    if path.starts_with(&client) {
        "cache"
    } else if RESOURCE_DIR.get().is_some_and(|d| path.starts_with(d)) {
        "bundled"
    } else {
        "local"
    }
}

fn list_versions(current: Option<&str>, pinned: Option<&str>) -> Vec<ModVersion> {
    let mut out: Vec<ModVersion> = Vec::new();
    for (version, c) in all_jars() {
        if let Some(existing) = out.iter_mut().find(|m| m.version == version) {
            // Same version in several places: the downloaded copy is the one worth naming.
            if classify_source(&c.path) == "cache" {
                existing.source = "cache".into();
            }
            continue;
        }
        out.push(ModVersion {
            current: current == Some(version.as_str()),
            pinned: pinned == Some(version.as_str()),
            source: classify_source(&c.path).into(),
            size: c.len,
            version,
        });
    }
    out.sort_by_key(|m| std::cmp::Reverse(version_key(&m.version)));
    out
}

fn build_status(offline: bool) -> ModUpdateStatus {
    let settings = current_settings();
    let installed = discover_best_jar().and_then(|c| jar_version_string(&c.path));
    let latest = LATEST_SEEN.lock().ok().and_then(|g| g.clone());
    let update_available = settings.mod_channel != "local"
        && latest
            .as_ref()
            .is_some_and(|l| installed.as_deref().map(|i| is_newer_version(i, &l.version)).unwrap_or(true));
    ModUpdateStatus {
        versions: list_versions(installed.as_deref(), settings.mod_pinned.as_deref()),
        installed,
        latest: latest.as_ref().map(|l| l.version.clone()),
        latest_prerelease: latest.as_ref().is_some_and(|l| l.prerelease),
        update_available,
        channel: settings.mod_channel,
        pinned: settings.mod_pinned,
        auto_update: settings.mod_auto_update,
        offline,
    }
}

fn save_pin(pin: Option<String>) -> AppResult<()> {
    let mut settings = current_settings();
    settings.mod_pinned = pin;
    crate::store::write_json(&paths::launcher_config_file(), &settings)
}

/// What the launcher knows right now, without the network (for other modules, e.g. the crash analyzer).
pub fn current_status_snapshot() -> ModUpdateStatus {
    build_status(false)
}

/// What the launcher knows right now, with no network.
#[tauri::command]
pub async fn mod_update_status() -> AppResult<ModUpdateStatus> {
    crate::blocking(|| Ok(build_status(false))).await
}

/// Asks GitHub whether a newer mod exists on the player's channel.
#[tauri::command]
pub async fn mod_update_check() -> AppResult<ModUpdateStatus> {
    let channel = current_settings().mod_channel;
    let mut offline = false;
    if channel != "local" {
        offline = fetch_latest(&channel, Duration::from_secs(8)).await.is_err();
    }
    crate::blocking(move || Ok(build_status(offline))).await
}

/// Downloads and keeps the newest mod now, with progress events. Clears a pinned version: asking for the
/// newest means leaving the old one.
#[tauri::command]
pub async fn mod_update_install(app: AppHandle) -> AppResult<ModUpdateStatus> {
    let settings = current_settings();
    if settings.mod_channel == "local" {
        return Err(AppError::invalid("the local channel never downloads"));
    }
    if settings.mod_pinned.is_some() {
        crate::blocking(|| save_pin(None)).await?;
    }
    if let Err(e) = download_newer(&settings.mod_channel, Some(&app), Duration::from_secs(10)).await {
        return Err(AppError::network(e));
    }
    crate::blocking(|| Ok(build_status(false))).await
}

/// Rolls back (or forward) to a version that is on this computer, until the player unpins it.
#[tauri::command]
pub async fn mod_use_version(version: String) -> AppResult<ModUpdateStatus> {
    crate::blocking(move || {
        if find_version(&version).is_none() {
            return Err(AppError::not_found(format!("mod version {version} is not on this computer")));
        }
        save_pin(Some(version))?;
        Ok(build_status(false))
    })
    .await
}

#[tauri::command]
pub async fn mod_unpin() -> AppResult<ModUpdateStatus> {
    crate::blocking(|| {
        save_pin(None)?;
        Ok(build_status(false))
    })
    .await
}

fn seed_cache_from(source: &Path) -> AppResult<PathBuf> {
    let cache = cache_path();
    if let Some(parent) = cache.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("client mod cache dir: {e}"))?;
    }
    if source.canonicalize().ok().as_ref() == cache.canonicalize().ok().as_ref() {
        return Ok(cache);
    }
    let pinned = pinned_version().is_some();
    let refresh = match (source.metadata(), cache.metadata()) {
        (Ok(src), Ok(dst)) => {
            let src_ver = candidate_from(source.to_path_buf()).map(|c| c.version);
            let dst_ver = candidate_from(cache.clone()).map(|c| c.version);
            match (src_ver, dst_ver) {
                // A pinned version may be older than what the cache holds: it still replaces it.
                (Some(sv), Some(dv)) if sv != dv => pinned || sv > dv,
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
    jar_version_string(path)
}

fn purge_legacy(mods: &Path) {
    let Ok(entries) = std::fs::read_dir(mods) else { return };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_lowercase();
        let is_legacy = LEGACY_NAMES.iter().any(|n| name == *n)
            || (name.contains("swiftclient")
                && name.ends_with(".jar")
                && name != MOD_FILE_NAME);
        if is_legacy {
            let _ = std::fs::remove_file(entry.path());
        }
    }
}

/// Swift instances: created as such, or already carrying the mod (instances made by older launchers).
/// Any other instance is left alone: the mod only runs on Fabric for its own Minecraft version.
pub fn is_swift_instance(instance_id: &str) -> bool {
    has_client_mod(instance_id)
        || crate::store::read_json::<crate::models::Instance>(&paths::instance_config_file(instance_id))
            .ok()
            .flatten()
            .is_some_and(|i| i.swift)
}

/// Copy the newest Swift client mod into a Swift instance's `minecraft/mods` folder.
pub fn ensure_installed(instance_id: &str) -> AppResult<ClientModStatus> {
    if !is_swift_instance(instance_id) {
        return Ok(status(instance_id));
    }

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
    let pinned = pinned_version().is_some();
    let needs_copy = match (candidate_from(cache.clone()), candidate_from(dest.clone())) {
        (Some(src), Some(dst)) if pinned => src.version != dst.version || src.len != dst.len,
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
    if is_swift_instance(instance_id) && !has_client_mod(instance_id) && discover_best_jar().is_none() {
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
    refresh_from_releases().await;
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

/// Creates a ready-to-play Swift Client instance: Fabric on the mod's Minecraft version, the Swift
/// mod and Fabric API. Nothing is left behind if a step fails.
#[tauri::command]
pub async fn create_swift_instance(name: Option<String>) -> AppResult<crate::models::Instance> {
    let name = name.map(|n| n.trim().to_string()).filter(|n| !n.is_empty()).unwrap_or_else(|| "Swift Client".into());
    let instance = crate::blocking(move || {
        if discover_best_jar().is_none() {
            return Err(AppError::invalid("Swift Client mod not found in this launcher installation"));
        }
        let mut instance = crate::commands::instances::make_instance(
            name,
            SWIFT_MC_VERSION.into(),
            crate::models::Loader::Fabric(SWIFT_FABRIC_LOADER.into()),
            None,
            None,
        )?;
        instance.swift = true;
        crate::store::write_json(&paths::instance_config_file(&instance.id), &instance)?;
        if let Err(e) = ensure_installed(&instance.id) {
            let _ = std::fs::remove_dir_all(paths::instance_dir(&instance.id));
            return Err(e);
        }
        Ok(instance)
    })
    .await?;

    match crate::commands::modrinth::install_latest(&instance.id, FABRIC_API_PROJECT, SWIFT_MC_VERSION, "fabric").await {
        Ok(added) if !added.is_empty() => Ok(instance),
        Ok(_) => {
            let _ = std::fs::remove_dir_all(paths::instance_dir(&instance.id));
            Err(AppError::network(format!("no Fabric API release for Minecraft {SWIFT_MC_VERSION} on Modrinth")))
        }
        Err(e) => {
            let _ = std::fs::remove_dir_all(paths::instance_dir(&instance.id));
            Err(e)
        }
    }
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
    use super::{
        cmp_candidates, is_newer_version, launch_check_due, parse_version_str, pick_release, version_key, versions_to_prune,
        Candidate, LAUNCH_CHECK_EVERY_SECS,
    };
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

    #[test]
    fn versions_order_like_semver_with_prereleases() {
        assert!(is_newer_version("2.3.0", "2.3.1"));
        assert!(is_newer_version("2.9.0", "2.10.0"));
        assert!(is_newer_version("2.4.0-beta.1", "2.4.0-beta.2"));
        assert!(is_newer_version("2.4.0-beta.2", "2.4.0"));
        assert!(!is_newer_version("2.4.0", "2.4.0-beta.9"));
        assert!(!is_newer_version("2.4.0", "2.4.0"));
        assert!(version_key("v2.4.0") == version_key("2.4.0"));
    }

    fn releases() -> serde_json::Value {
        serde_json::json!([
            { "draft": true, "prerelease": false, "assets": [{ "name": "swiftclient-mod-9.9.9.jar", "browser_download_url": "https://x/9.9.9", "size": 1 }] },
            { "draft": false, "prerelease": true, "assets": [
                { "name": "swiftclient-mod-2.4.0-beta.1-sources.jar", "browser_download_url": "https://x/src", "size": 1 },
                { "name": "swiftclient-mod-2.4.0-beta.1.jar", "browser_download_url": "https://x/b1", "size": 5, "digest": "sha256:ABCD" }
            ] },
            { "draft": false, "prerelease": false, "assets": [{ "name": "swiftclient-mod-2.3.0.jar", "browser_download_url": "https://x/230", "size": 7 }] },
            { "draft": false, "prerelease": false, "assets": [{ "name": "notes.txt", "browser_download_url": "https://x/n" }] }
        ])
    }

    #[test]
    fn stable_channel_skips_drafts_and_prereleases() {
        let r = pick_release(&releases(), "stable").expect("a stable release");
        assert_eq!(r.version, "2.3.0");
        assert!(!r.prerelease);
        assert_eq!(r.size, 7);
    }

    #[test]
    fn beta_channel_takes_the_newest_including_prereleases() {
        let r = pick_release(&releases(), "beta").expect("a beta release");
        assert_eq!(r.version, "2.4.0-beta.1");
        assert!(r.prerelease);
        assert_eq!(r.digest.as_deref(), Some("abcd"));
        assert!(r.name.ends_with(".jar") && !r.name.contains("sources"));
    }

    #[test]
    fn nothing_to_pick_gives_none() {
        assert!(pick_release(&serde_json::json!([]), "stable").is_none());
        assert!(pick_release(&serde_json::json!({}), "stable").is_none());
    }

    #[test]
    fn only_the_newest_versions_are_kept_and_the_pin_survives() {
        let all: Vec<String> = ["2.0.0", "2.3.0", "2.1.0", "2.2.0", "2.4.0-beta.1"].iter().map(|s| s.to_string()).collect();
        let mut gone = versions_to_prune(&all, 3, None);
        gone.sort();
        assert_eq!(gone, vec!["2.0.0".to_string(), "2.1.0".to_string()]);
        let gone = versions_to_prune(&all, 3, Some("2.0.0"));
        assert_eq!(gone, vec!["2.1.0".to_string()]);
        assert!(versions_to_prune(&all[..2], 3, None).is_empty());
    }

    #[test]
    fn the_launch_check_is_throttled() {
        assert!(launch_check_due(10_000, 0));
        assert!(!launch_check_due(1_000, 900));
        assert!(launch_check_due(LAUNCH_CHECK_EVERY_SECS + 5, 5));
    }
}
