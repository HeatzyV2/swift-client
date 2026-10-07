//! Client of the Swift Platform (`/api/v1`): the launcher bootstrap (announcements, maintenance, home
//! sections, servers, campaigns, flags, remote config) plus privacy-first telemetry.
//!
//! Everything here is optional: without a configured backend, or when it does not answer, the commands
//! return nothing and the launcher keeps working with what it ships with. Telemetry is a pseudonymous
//! batch of whitelisted events; it can be switched off in Settings and then nothing is sent, not even the
//! random device id.

use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::{backend, http, paths, store};

fn telemetry_file() -> PathBuf {
    paths::data_root().join("telemetry.json")
}

fn cache_file() -> PathBuf {
    paths::data_root().join("platform_cache.json")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Telemetry {
    #[serde(default)]
    device_id: String,
    /// Off until the player opts in (privacy first; the launcher says it sends nothing by default).
    #[serde(default)]
    enabled: bool,
    /// Whether the opt-in question was answered, so it is only asked once.
    #[serde(default)]
    asked: bool,
    #[serde(default)]
    last_version: String,
}

impl Default for Telemetry {
    fn default() -> Self {
        Self { device_id: String::new(), enabled: false, asked: false, last_version: String::new() }
    }
}

/// Serializes read-modify-write of telemetry.json.
static LOCK: Mutex<()> = Mutex::new(());

fn load() -> Telemetry {
    let _guard = LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let mut t = store::read_json::<Telemetry>(&telemetry_file()).ok().flatten().unwrap_or_default();
    if t.device_id.trim().len() < 8 {
        t.device_id = uuid::Uuid::new_v4().simple().to_string();
        let _ = store::write_json(&telemetry_file(), &t);
    }
    t
}

fn save(t: &Telemetry) {
    let _guard = LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let _ = store::write_json(&telemetry_file(), t);
}

const VERSION: &str = env!("CARGO_PKG_VERSION");

fn os_name() -> &'static str {
    match std::env::consts::OS {
        "windows" => "windows",
        "macos" => "macos",
        _ => "linux",
    }
}

fn arch_name() -> &'static str {
    match std::env::consts::ARCH {
        "aarch64" => "arm64",
        "x86" => "x86",
        _ => "x64",
    }
}

/// `{ success, data }` envelope of the platform API -> `data`.
fn unwrap_envelope(v: Value) -> Option<Value> {
    if v.get("success").and_then(Value::as_bool) == Some(true) {
        v.get("data").cloned()
    } else {
        None
    }
}

#[derive(Serialize)]
pub struct TelemetryStatus {
    pub enabled: bool,
    pub asked: bool,
    /// Previous launcher version when this start follows an update (reported once as `update_applied`).
    pub upgraded_from: Option<String>,
}

static UPGRADE_CHECKED: Mutex<bool> = Mutex::new(false);

#[tauri::command]
pub fn platform_telemetry_status() -> TelemetryStatus {
    let mut t = load();
    let mut checked = UPGRADE_CHECKED.lock().unwrap_or_else(|e| e.into_inner());
    let mut upgraded_from = None;
    if !*checked {
        *checked = true;
        if !t.last_version.is_empty() && t.last_version != VERSION {
            upgraded_from = Some(t.last_version.clone());
        }
        if t.last_version != VERSION {
            t.last_version = VERSION.to_string();
            save(&t);
        }
    }
    TelemetryStatus { enabled: t.enabled, asked: t.asked, upgraded_from }
}

#[tauri::command]
pub fn platform_set_telemetry(enabled: bool) {
    let mut t = load();
    t.enabled = enabled;
    t.asked = true;
    save(&t);
}

/// Everything the launcher needs at start-up, in one call. Falls back to the last good answer when the
/// backend is unreachable (the result is then flagged `stale`). `None` when there is nothing at all.
#[tauri::command]
pub async fn platform_bootstrap(locale: String, authenticated: bool, mc_version: Option<String>) -> Option<Value> {
    let url = backend::endpoint("/api/v1/launcher/bootstrap").ok()?;
    let t = load();
    let mut query: Vec<(&str, String)> = vec![
        ("v", VERSION.to_string()),
        ("os", os_name().to_string()),
        ("arch", arch_name().to_string()),
        ("locale", locale.chars().take(10).collect()),
        ("auth", if authenticated { "1" } else { "0" }.to_string()),
        ("channel", "stable".to_string()),
    ];
    if let Some(mc) = mc_version.filter(|m| !m.is_empty() && m.len() <= 24) {
        query.push(("mc", mc));
    }
    // The device id only leaves this machine when telemetry is on (it drives staged rollouts and A/B arms).
    if t.enabled {
        query.push(("device", t.device_id.clone()));
    }

    let fetched = async {
        let resp = http().get(&url).query(&query).timeout(Duration::from_secs(8)).send().await.ok()?;
        if !resp.status().is_success() {
            return None;
        }
        unwrap_envelope(resp.json::<Value>().await.ok()?)
    }
    .await;

    match fetched {
        Some(data) => {
            let _ = store::write_json(&cache_file(), &data);
            Some(data)
        }
        None => {
            let mut cached = store::read_json::<Value>(&cache_file()).ok().flatten()?;
            if let Some(obj) = cached.as_object_mut() {
                obj.insert("stale".to_string(), Value::Bool(true));
            }
            Some(cached)
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct TrackEvent {
    pub name: String,
    #[serde(default)]
    pub props: Option<Value>,
}

fn context(locale: &str, mc_version: &Option<String>) -> Value {
    let mut ctx = json!({
        "launcherVersion": VERSION,
        "os": os_name(),
        "arch": arch_name(),
        "locale": locale.chars().take(10).collect::<String>(),
    });
    if let Some(mc) = mc_version.as_ref().filter(|m| !m.is_empty() && m.len() <= 24) {
        ctx["mcVersion"] = Value::String(mc.clone());
    }
    ctx
}

/// Sends a batch of whitelisted events. Best effort: failures are dropped, never retried or queued.
#[tauri::command]
pub async fn platform_track(events: Vec<TrackEvent>, locale: String, mc_version: Option<String>) -> u32 {
    let t = load();
    if !t.enabled || events.is_empty() {
        return 0;
    }
    let Ok(url) = backend::endpoint("/api/v1/analytics/events") else { return 0 };
    let batch: Vec<Value> = events
        .into_iter()
        .take(50)
        .map(|e| json!({ "name": e.name, "props": e.props.unwrap_or_else(|| json!({})) }))
        .collect();
    let body = json!({ "deviceId": t.device_id, "context": context(&locale, &mc_version), "events": batch });
    match http().post(&url).json(&body).timeout(Duration::from_secs(6)).send().await {
        Ok(r) if r.status().is_success() => body["events"].as_array().map_or(0, |a| a.len() as u32),
        _ => 0,
    }
}

/// Files a categorized error report. The server scrubs paths, e-mails and tokens; nothing is sent when
/// telemetry is off.
#[tauri::command]
pub async fn platform_report(
    category: String,
    code: Option<String>,
    message: Option<String>,
    details: Option<Value>,
    locale: String,
    mc_version: Option<String>,
) -> bool {
    let t = load();
    if !t.enabled {
        return false;
    }
    let Ok(url) = backend::endpoint("/api/v1/diagnostics/report") else { return false };
    let mut body = json!({
        "category": category,
        "deviceId": t.device_id,
        "context": context(&locale, &mc_version),
    });
    if let Some(c) = code {
        body["code"] = Value::String(c.chars().take(40).collect());
    }
    if let Some(m) = message {
        body["message"] = Value::String(m.chars().take(1500).collect());
    }
    if let Some(Value::Object(d)) = details {
        // The API accepts at most 20 short scalar fields.
        let trimmed: serde_json::Map<String, Value> = d
            .into_iter()
            .filter(|(k, v)| k.len() <= 40 && (v.is_string() || v.is_number() || v.is_boolean()))
            .take(20)
            .collect();
        body["details"] = Value::Object(trimmed);
    }
    matches!(
        http().post(&url).json(&body).timeout(Duration::from_secs(6)).send().await,
        Ok(r) if r.status().is_success()
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn envelope_is_unwrapped_only_on_success() {
        assert_eq!(unwrap_envelope(json!({ "success": true, "data": { "a": 1 } })), Some(json!({ "a": 1 })));
        assert_eq!(unwrap_envelope(json!({ "success": false, "error": { "code": "X" } })), None);
        assert_eq!(unwrap_envelope(json!({ "ok": true })), None);
    }

    #[test]
    fn platform_names_match_the_api_vocabulary() {
        assert!(["windows", "macos", "linux"].contains(&os_name()));
        assert!(["x64", "arm64", "x86"].contains(&arch_name()));
    }
}
