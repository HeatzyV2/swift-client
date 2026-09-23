use crate::models::Settings;
use crate::{paths, store, AppState};
use crate::error::AppResult;
use tauri::State;

pub fn load() -> AppResult<Settings> {
    Ok(store::read_json::<Settings>(&paths::launcher_config_file())?.unwrap_or_default())
}

#[tauri::command]
pub async fn get_settings() -> AppResult<Settings> {
    crate::blocking(load).await
}

#[tauri::command]
pub async fn save_settings(state: State<'_, AppState>, settings: Settings) -> AppResult<()> {
    crate::blocking(move || store::write_json(&paths::launcher_config_file(), &settings)).await?;
    // Live-toggle Discord presence when privacy settings change.
    crate::discord::update_presence(&state);
    Ok(())
}

/// Remembers the instance the Home screen launches, without touching the rest
/// of the settings file (the Settings page may be saving it at the same time).
#[tauri::command]
pub async fn set_last_instance(id: Option<String>) -> AppResult<()> {
    crate::blocking(move || {
        let mut settings = load()?;
        settings.last_instance_id = id;
        store::write_json(&paths::launcher_config_file(), &settings)
    })
    .await
}

#[tauri::command]
pub fn get_system_memory_mb() -> u64 {
    let mut sys = sysinfo::System::new();
    sys.refresh_memory();
    sys.total_memory() / (1024 * 1024)
}

/// Push the UI language + current screen into Discord Rich Presence.
#[tauri::command]
pub fn discord_sync(state: State<'_, AppState>, locale: String, screen: String) {
    crate::discord::sync(&state, &locale, &screen);
}
