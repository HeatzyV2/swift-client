use crate::models::Settings;
use crate::{paths, store};
use crate::error::AppResult;

pub fn load() -> AppResult<Settings> {
    Ok(store::read_json::<Settings>(&paths::launcher_config_file())?.unwrap_or_default())
}

#[tauri::command]
pub async fn get_settings() -> AppResult<Settings> {
    crate::blocking(load).await
}

#[tauri::command]
pub async fn save_settings(settings: Settings) -> AppResult<()> {
    crate::blocking(move || store::write_json(&paths::launcher_config_file(), &settings)).await
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
