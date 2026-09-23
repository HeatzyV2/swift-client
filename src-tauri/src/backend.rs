//! The optional Swift Client web backend.
//!
//! Features that need a server — CurseForge (the API key cannot ship in the
//! binary), instance sharing by code — go through here. The address is set at
//! build time with `SWIFT_BACKEND_URL` (see `.env.example`). When it is unset,
//! which is the default, those features report themselves unavailable and the
//! launcher never opens a connection for them.

use serde::Serialize;

use crate::error::{AppError, AppResult};

pub fn base_url() -> Option<&'static str> {
    option_env!("SWIFT_BACKEND_URL")
        .map(|url| url.trim().trim_end_matches('/'))
        .filter(|url| url.starts_with("https://"))
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
    AppError::new("backend_unavailable", "this feature needs the Swift Client online service, which is not available yet")
}

/// The signed-in Swift account session, for routes that need one.
///
/// Swift accounts do not exist yet, so nothing is ever signed in.
pub fn session_token() -> Option<String> {
    None
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
