//! One zip the player can send to support: versions, settings, the mod situation, and the recent logs and
//! crash report of each instance, with anything that looks like a credential masked.

use std::io::Write;
use std::path::{Path, PathBuf};

use crate::commands::{client_mod, memory_advisor, settings};
use crate::error::AppResult;
use crate::models::Instance;
use crate::{paths, store};

/// The newest few instances are included; more would only bury the useful part.
const MAX_INSTANCES: usize = 5;
const LOG_TAIL_BYTES: usize = 300_000;
const KEEP_EXPORTS: usize = 5;

/// Masks tokens and secrets: `--accessToken abc`, `"access_token":"abc"`, `Bearer abc`, `session:token:abc`.
pub fn redact(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for line in text.lines() {
        out.push_str(&redact_line(line));
        out.push('\n');
    }
    out
}

fn redact_line(line: &str) -> String {
    let mut s = line.to_string();
    for key in ["--accessToken", "--uuid", "--xuid", "--clientId", "Bearer", "session:token:"] {
        while let Some(at) = s.find(key) {
            let rest_start = at + key.len();
            let rest = &s[rest_start..];
            let skip_ws = rest.len() - rest.trim_start().len();
            let value_start = rest_start + skip_ws;
            let value_len = s[value_start..].find(char::is_whitespace).unwrap_or(s.len() - value_start);
            if value_len == 0 {
                // Nothing to mask here; keep scanning after this occurrence.
                s = format!("{}{}{}", &s[..at], "[key]", &s[rest_start..]);
                continue;
            }
            s.replace_range(value_start..value_start + value_len, "***");
            // Make sure the same occurrence is not found again.
            s.replace_range(at..at + key.len(), &key.replace(['-', ':'], "_").to_uppercase());
        }
    }
    for key in ["access_token", "refresh_token", "accessToken", "refreshToken", "password"] {
        let pattern = format!("\"{key}\"");
        while let Some(at) = s.find(&pattern) {
            let after = at + pattern.len();
            let Some(colon) = s[after..].find(':') else { break };
            let value_start = after + colon + 1;
            let trimmed = s[value_start..].trim_start();
            let lead = s[value_start..].len() - trimmed.len();
            let begin = value_start + lead;
            let end = if trimmed.starts_with('"') {
                s[begin + 1..].find('"').map(|i| begin + 1 + i + 1).unwrap_or(s.len())
            } else {
                s[begin..].find([',', '}']).map(|i| begin + i).unwrap_or(s.len())
            };
            s.replace_range(begin..end, "\"***\"");
            s.replace_range(at..after, &format!("\"{}_\"", key));
        }
    }
    s
}

fn tail(path: &Path, max: usize) -> Option<String> {
    let bytes = std::fs::read(path).ok()?;
    let slice = if bytes.len() > max { &bytes[bytes.len() - max..] } else { &bytes[..] };
    Some(String::from_utf8_lossy(slice).into_owned())
}

fn newest_file(dir: &Path, ext: &[&str]) -> Option<PathBuf> {
    std::fs::read_dir(dir)
        .ok()?
        .flatten()
        .filter(|e| e.path().is_file() && e.path().extension().and_then(|x| x.to_str()).is_some_and(|x| ext.contains(&x)))
        .max_by_key(|e| e.metadata().and_then(|m| m.modified()).ok())
        .map(|e| e.path())
}

fn summary() -> String {
    let settings = settings::load().unwrap_or_default();
    let status = client_mod::current_status_snapshot();
    let mut s = String::new();
    s.push_str(&format!("Swift launcher {}\n", env!("CARGO_PKG_VERSION")));
    s.push_str(&format!("OS: {} {}\n", std::env::consts::OS, std::env::consts::ARCH));
    s.push_str(&format!("System memory: {} MB\n", memory_advisor::system_memory_mb()));
    s.push_str(&format!("Data folder: {}\n", paths::data_root().display()));
    s.push_str(&format!("Default memory: {} MB\n", settings.default_memory_mb));
    s.push_str(&format!(
        "Mod channel: {}, auto update: {}, pinned: {}\n",
        settings.mod_channel,
        settings.mod_auto_update,
        settings.mod_pinned.as_deref().unwrap_or("none")
    ));
    s.push_str(&format!(
        "Mod in use: {}, latest seen: {}\n",
        status.installed.as_deref().unwrap_or("none"),
        status.latest.as_deref().unwrap_or("unknown")
    ));
    s.push_str("Mod versions on disk:\n");
    for v in &status.versions {
        s.push_str(&format!("  {} ({}, {} bytes){}\n", v.version, v.source, v.size, if v.current { " <- in use" } else { "" }));
    }
    s
}

fn instance_line(inst: &Instance) -> String {
    let mods = std::fs::read_dir(paths::instance_game_dir(&inst.id).join("mods"))
        .map(|e| e.flatten().map(|f| f.file_name().to_string_lossy().into_owned()).collect::<Vec<_>>())
        .unwrap_or_default();
    format!(
        "{} | {} | mc {} | {:?} | memory {} | swift {} | {} mod file(s)\n{}\n",
        inst.id,
        inst.name,
        inst.mc_version,
        inst.loader,
        inst.memory_mb.map(|m| m.to_string()).unwrap_or_else(|| "default".into()),
        inst.swift,
        mods.len(),
        mods.iter().map(|m| format!("    {m}")).collect::<Vec<_>>().join("\n")
    )
}

fn zip_text(zip: &mut zip::ZipWriter<std::fs::File>, name: &str, text: &str) -> AppResult<()> {
    let opts = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    zip.start_file(name, opts).map_err(|e| format!("diagnostics zip: {e}"))?;
    zip.write_all(text.as_bytes()).map_err(|e| format!("diagnostics zip: {e}"))?;
    Ok(())
}

fn prune_exports(dir: &Path) {
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    let mut files: Vec<_> = entries.flatten().filter(|e| e.file_name().to_string_lossy().starts_with("swift-diagnostics-")).collect();
    files.sort_by_key(|e| std::cmp::Reverse(e.metadata().and_then(|m| m.modified()).ok()));
    for old in files.into_iter().skip(KEEP_EXPORTS) {
        let _ = std::fs::remove_file(old.path());
    }
}

/// Writes the diagnostics zip and returns its path.
#[tauri::command]
pub async fn export_diagnostics() -> AppResult<String> {
    crate::blocking(|| {
        let dir = paths::data_root().join("diagnostics");
        std::fs::create_dir_all(&dir).map_err(|e| format!("create diagnostics dir: {e}"))?;
        let stamp = chrono::Local::now().format("%Y%m%d-%H%M%S");
        let path = dir.join(format!("swift-diagnostics-{stamp}.zip"));
        let file = std::fs::File::create(&path).map_err(|e| format!("create diagnostics zip: {e}"))?;
        let mut zip = zip::ZipWriter::new(file);

        zip_text(&mut zip, "summary.txt", &summary())?;

        // launcher.json without credentials-looking values, and without hooks / env values that may hold secrets
        let mut cfg = settings::load().unwrap_or_default();
        for e in cfg.default_env_vars.iter_mut() {
            e.value = "***".into();
        }
        let cfg_text = serde_json::to_string_pretty(&cfg).unwrap_or_default();
        zip_text(&mut zip, "launcher-settings.json", &redact(&cfg_text))?;

        if let Some(log) = newest_file(&paths::logs_dir(), &["log", "txt"]).and_then(|p| tail(&p, LOG_TAIL_BYTES)) {
            zip_text(&mut zip, "launcher.log", &redact(&log))?;
        }

        let mut instances: Vec<Instance> = std::fs::read_dir(paths::instances_dir())
            .map(|entries| {
                entries
                    .flatten()
                    .filter_map(|e| store::read_json::<Instance>(&e.path().join("instance.json")).ok().flatten())
                    .collect()
            })
            .unwrap_or_default();
        instances.sort_by(|a, b| b.last_played.cmp(&a.last_played));
        let listing: String = instances.iter().map(instance_line).collect();
        zip_text(&mut zip, "instances.txt", &listing)?;

        for inst in instances.iter().take(MAX_INSTANCES) {
            let game = paths::instance_game_dir(&inst.id);
            if let Some(log) = tail(&game.join("logs").join("latest.log"), LOG_TAIL_BYTES) {
                zip_text(&mut zip, &format!("instances/{}/latest.log", inst.id), &redact(&log))?;
            }
            if let Some(crash) = newest_file(&game.join("crash-reports"), &["txt"]).and_then(|p| tail(&p, LOG_TAIL_BYTES)) {
                zip_text(&mut zip, &format!("instances/{}/crash-report.txt", inst.id), &redact(&crash))?;
            }
        }

        zip.finish().map_err(|e| format!("diagnostics zip: {e}"))?;
        prune_exports(&dir);
        Ok(path.to_string_lossy().into_owned())
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::redact;

    #[test]
    fn launch_arguments_lose_their_tokens() {
        let line = "java -Xmx4G --username Zor --uuid 1234abcd --accessToken eyJhbGciOi.secret.part --userType msa";
        let out = redact(line);
        assert!(!out.contains("eyJhbGciOi"), "{out}");
        assert!(!out.contains("1234abcd"), "{out}");
        assert!(out.contains("--username Zor"), "{out}");
        assert!(out.contains("--userType msa"), "{out}");
    }

    #[test]
    fn json_credentials_and_bearer_headers_are_masked() {
        let out = redact("{\"access_token\":\"abc123\",\"name\":\"Zor\",\"refresh_token\": \"zzz\"}\nAuthorization: Bearer abc.def.ghi\n");
        assert!(!out.contains("abc123") && !out.contains("zzz") && !out.contains("abc.def.ghi"), "{out}");
        assert!(out.contains("\"name\":\"Zor\""), "{out}");
    }

    #[test]
    fn ordinary_text_is_untouched() {
        let text = "[10:22:01] [main/INFO]: Loading Minecraft 26.2 with Fabric Loader 0.19.5\n";
        assert_eq!(redact(text), text);
    }
}
