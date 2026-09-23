//! The optional Swift Client web backend.
//!
//! Features that need a server — CurseForge (the API key cannot ship in the
//! binary), instance sharing by code, and remote Social — go through here.
//! The address is set at build time with `SWIFT_BACKEND_URL` (see `.env.example`).
//! Social still works in local mode without a server.

use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};
use crate::{http, paths, store};

pub fn base_url() -> Option<&'static str> {
    option_env!("SWIFT_BACKEND_URL")
        .map(|url| url.trim().trim_end_matches('/'))
        .filter(|url| url.starts_with("https://") || url.starts_with("http://"))
}

pub fn is_configured() -> bool {
    base_url().is_some()
}

/// Full URL of a backend route, or a `backend_unavailable` error.
pub fn endpoint(path: &str) -> AppResult<String> {
    let base = base_url().ok_or_else(unavailable)?;
    Ok(format!("{base}{path}"))
}

pub fn unavailable() -> AppError {
    AppError::new(
        "backend_unavailable",
        "this feature needs the Swift Client online service, which is not available yet",
    )
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SwiftSession {
    pub token: String,
    pub user_id: String,
    pub username: String,
    #[serde(default)]
    pub mc_uuid: Option<String>,
    #[serde(default)]
    pub mc_username: Option<String>,
}

fn load_session() -> Option<SwiftSession> {
    store::read_json_private::<SwiftSession>(&paths::swift_session_file())
        .ok()
        .flatten()
        .filter(|s| !s.token.trim().is_empty())
}

fn save_session(session: &SwiftSession) -> AppResult<()> {
    store::write_json_private(&paths::swift_session_file(), session)
}

fn clear_session() -> AppResult<()> {
    let path = paths::swift_session_file();
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// The signed-in Swift account session token, for routes that need one.
pub fn session_token() -> Option<String> {
    load_session().map(|s| s.token)
}

#[derive(Serialize)]
pub struct BackendStatus {
    pub configured: bool,
    pub accounts: bool,
    /// Whether this build can show Discord Rich Presence (not a server feature,
    /// but reported here so the UI learns every build capability in one call).
    pub discord: bool,
}

#[tauri::command]
pub fn backend_status() -> BackendStatus {
    BackendStatus {
        configured: is_configured(),
        accounts: session_token().is_some(),
        discord: crate::discord::is_configured(),
    }
}

#[tauri::command]
pub fn swift_session() -> Option<SwiftSession> {
    load_session()
}

#[derive(Deserialize)]
pub struct SwiftAuthArgs {
    pub username: String,
    pub password: String,
}

#[derive(Deserialize)]
struct AuthReply {
    token: String,
    user: AuthUser,
}

#[derive(Deserialize)]
struct AuthUser {
    id: String,
    username: String,
    #[serde(default)]
    mc_uuid: Option<String>,
    #[serde(default)]
    mc_username: Option<String>,
}

async fn post_auth(path: &str, username: &str, password: &str) -> AppResult<SwiftSession> {
    let url = endpoint(path)?;
    let resp = http()
        .post(&url)
        .json(&serde_json::json!({ "username": username, "password": password }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        let status = resp.status();
        let detail = resp.text().await.unwrap_or_default();
        let msg = serde_json::from_str::<serde_json::Value>(&detail)
            .ok()
            .and_then(|v| {
                v.get("message")
                    .or_else(|| v.get("statusMessage"))
                    .and_then(|m| m.as_str())
                    .map(String::from)
            })
            .unwrap_or_else(|| format!("auth failed ({status})"));
        return Err(AppError::auth(msg));
    }
    let body: AuthReply = resp.json().await.map_err(|e| e.to_string())?;
    let session = SwiftSession {
        token: body.token,
        user_id: body.user.id,
        username: body.user.username,
        mc_uuid: body.user.mc_uuid,
        mc_username: body.user.mc_username,
    };
    save_session(&session)?;
    Ok(session)
}

#[tauri::command]
pub async fn swift_register(args: SwiftAuthArgs) -> AppResult<SwiftSession> {
    if !is_configured() {
        return Err(unavailable());
    }
    post_auth("/api/auth/register", args.username.trim(), &args.password).await
}

#[tauri::command]
pub async fn swift_login(args: SwiftAuthArgs) -> AppResult<SwiftSession> {
    if !is_configured() {
        return Err(unavailable());
    }
    post_auth("/api/auth/login", args.username.trim(), &args.password).await
}

#[tauri::command]
pub async fn swift_logout() -> AppResult<()> {
    clear_session()
}

/// Attach the active Microsoft Minecraft profile to the Swift account.
#[tauri::command]
pub async fn swift_link_minecraft() -> AppResult<SwiftSession> {
    let Some(mut session) = load_session() else {
        return Err(AppError::auth("sign in to your Swift Client account first"));
    };
    let accounts = store::read_json_private::<crate::models::AccountsFile>(&paths::accounts_file())?
        .unwrap_or_default();
    let active = accounts
        .active_uuid
        .as_ref()
        .and_then(|id| accounts.accounts.iter().find(|a| &a.uuid == id))
        .or_else(|| accounts.accounts.first())
        .ok_or_else(|| AppError::auth("add a Microsoft account first"))?;
    if active.kind != crate::models::AccountKind::Microsoft {
        return Err(AppError::auth("link requires a Microsoft Minecraft account"));
    }

    let url = endpoint("/api/me/link-minecraft")?;
    let resp = http()
        .post(&url)
        .bearer_auth(&session.token)
        .json(&serde_json::json!({
            "uuid": active.uuid,
            "username": active.username,
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        let detail = resp.text().await.unwrap_or_default();
        return Err(AppError::auth(detail));
    }
    let body: AuthReply = resp.json().await.map_err(|e| e.to_string())?;
    session.token = body.token;
    session.user_id = body.user.id;
    session.username = body.user.username;
    session.mc_uuid = body.user.mc_uuid;
    session.mc_username = body.user.mc_username;
    save_session(&session)?;
    Ok(session)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unconfigured_build_never_builds_an_address() {
        if base_url().is_none() {
            assert!(endpoint("/api/share").is_err());
            assert!(!backend_status().configured);
        }
    }
}
