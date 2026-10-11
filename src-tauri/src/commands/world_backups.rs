//! Automatic and manual backups of singleplayer worlds, kept per instance in `world-backups/`.
//!
//! A world is zipped before a launch when it changed since its last backup (at most every couple of
//! hours), the newest few automatic ones are kept, and a restore never throws the current world away: it is
//! set aside next to the others first.

use std::path::{Path, PathBuf};
use std::time::SystemTime;

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::commands::{content, import, settings};
use crate::error::{AppError, AppResult};
use crate::{paths, AppState};

/// A world that was backed up less than this long ago is left alone, even if it changed.
const MIN_GAP_MS: i64 = 2 * 60 * 60 * 1000;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct WorldBackup {
    pub file: String,
    /// Folder name of the world inside `saves/`.
    pub world: String,
    pub created: i64,
    pub size: u64,
    pub auto: bool,
}

fn backups_dir(id: &str) -> PathBuf {
    paths::instance_dir(id).join("world-backups")
}

fn saves_dir(id: &str) -> PathBuf {
    paths::instance_game_dir(id).join("saves")
}

fn file_name(world: &str, created: i64, auto: bool) -> String {
    format!("{world}__{created}__{}.zip", if auto { "a" } else { "m" })
}

/// `(world, created_ms, auto)` out of a backup file name, or None for a file that is not one of ours.
pub fn parse_backup_name(name: &str) -> Option<(String, i64, bool)> {
    let stem = name.strip_suffix(".zip")?;
    let mut parts = stem.rsplitn(3, "__");
    let kind = parts.next()?;
    let created = parts.next()?.parse::<i64>().ok()?;
    let world = parts.next()?;
    if world.is_empty() {
        return None;
    }
    match kind {
        "a" => Some((world.to_string(), created, true)),
        "m" => Some((world.to_string(), created, false)),
        _ => None,
    }
}

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

fn read_backups(id: &str) -> Vec<WorldBackup> {
    let dir = backups_dir(id);
    let Ok(entries) = std::fs::read_dir(&dir) else { return Vec::new() };
    let mut out: Vec<WorldBackup> = entries
        .flatten()
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().into_owned();
            let (world, created, auto) = parse_backup_name(&name)?;
            Some(WorldBackup { size: e.metadata().map(|m| m.len()).unwrap_or(0), file: name, world, created, auto })
        })
        .collect();
    out.sort_by(|a, b| b.created.cmp(&a.created));
    out
}

/// The automatic backups of `world` that go once only `keep` remain (oldest first). Manual ones stay.
fn backups_to_prune(backups: &[WorldBackup], world: &str, keep: usize) -> Vec<String> {
    let mut autos: Vec<&WorldBackup> = backups.iter().filter(|b| b.auto && b.world == world).collect();
    autos.sort_by_key(|b| b.created);
    let over = autos.len().saturating_sub(keep);
    autos.into_iter().take(over).map(|b| b.file.clone()).collect()
}

/// Has the world changed since its last backup, and is that backup old enough to be worth replacing?
fn needs_backup(world_changed_ms: i64, newest_backup_ms: Option<i64>, now: i64) -> bool {
    match newest_backup_ms {
        None => true,
        Some(last) => world_changed_ms > last && now - last >= MIN_GAP_MS,
    }
}

fn modified_ms(path: &Path) -> Option<i64> {
    let t = path.metadata().ok()?.modified().ok()?;
    let d = t.duration_since(SystemTime::UNIX_EPOCH).ok()?;
    Some(d.as_millis() as i64)
}

fn make_backup(id: &str, world: &str, auto: bool) -> AppResult<WorldBackup> {
    let safe = content::safe_name(world)?;
    let src = saves_dir(id).join(&safe);
    if !src.is_dir() {
        return Err(AppError::not_found("world not found"));
    }
    let dir = backups_dir(id);
    std::fs::create_dir_all(&dir).map_err(|e| format!("create world-backups dir: {e}"))?;
    let created = now_ms();
    let name = file_name(&safe, created, auto);
    let dest = dir.join(&name);
    if let Err(e) = content::zip_dir(&src, &safe, &dest) {
        let _ = std::fs::remove_file(&dest);
        return Err(format!("world backup: {e}").into());
    }
    let size = std::fs::metadata(&dest).map(|m| m.len()).unwrap_or(0);

    let keep = settings::load().map(|s| s.world_backup_keep.max(1) as usize).unwrap_or(5);
    let all = read_backups(id);
    for old in backups_to_prune(&all, &safe, keep) {
        let _ = std::fs::remove_file(dir.join(old));
    }
    Ok(WorldBackup { file: name, world: safe, created, size, auto })
}

/// Backs up the worlds that changed since their last backup. Returns how many were saved.
fn auto_backup_blocking(id: &str) -> usize {
    if !settings::load().map(|s| s.auto_world_backup).unwrap_or(true) {
        return 0;
    }
    let Ok(entries) = std::fs::read_dir(saves_dir(id)) else { return 0 };
    let existing = read_backups(id);
    let now = now_ms();
    let mut saved = 0;
    for entry in entries.flatten() {
        let path = entry.path();
        let level = path.join("level.dat");
        if !path.is_dir() || !level.is_file() {
            continue;
        }
        let world = entry.file_name().to_string_lossy().into_owned();
        let changed = modified_ms(&level).unwrap_or(0);
        let newest = existing.iter().filter(|b| b.world == world).map(|b| b.created).max();
        if needs_backup(changed, newest, now) {
            match make_backup(id, &world, true) {
                Ok(_) => saved += 1,
                Err(e) => log::warn!("automatic backup of world {world} failed: {e}"),
            }
        }
    }
    saved
}

/// Starts the automatic backup without making the launch wait for it. The worlds are not open yet when the
/// copy starts: the game takes longer to reach a world than a backup takes to read it.
pub fn auto_backup_in_background(app: &AppHandle, id: &str) {
    let app = app.clone();
    let id = id.to_string();
    tauri::async_runtime::spawn(async move {
        let for_task = id.clone();
        let saved = tauri::async_runtime::spawn_blocking(move || auto_backup_blocking(&for_task)).await.unwrap_or(0);
        if saved > 0 {
            log::info!("backed up {saved} world(s) of {id}");
            let _ = app.emit("world-backup://done", serde_json::json!({ "instance_id": id, "count": saved }));
        }
    });
}

#[tauri::command]
pub async fn list_world_backups(id: String, world: Option<String>) -> AppResult<Vec<WorldBackup>> {
    crate::blocking(move || {
        let mut list = read_backups(&id);
        if let Some(w) = world {
            list.retain(|b| b.world == w);
        }
        Ok(list)
    })
    .await
}

#[tauri::command]
pub async fn create_world_backup(id: String, world: String) -> AppResult<WorldBackup> {
    crate::blocking(move || make_backup(&id, &world, false)).await
}

#[tauri::command]
pub async fn delete_world_backup(id: String, file: String) -> AppResult<()> {
    crate::blocking(move || {
        let safe = content::safe_name(&file)?;
        if parse_backup_name(&safe).is_none() {
            return Err(AppError::invalid("not a world backup"));
        }
        let path = backups_dir(&id).join(safe);
        if path.is_file() {
            std::fs::remove_file(path).map_err(|e| format!("delete backup: {e}"))?;
        }
        Ok(())
    })
    .await
}

/// Puts a backed-up world back. The world that is there now is moved aside, never deleted.
#[tauri::command]
pub async fn restore_world_backup(state: State<'_, AppState>, id: String, file: String) -> AppResult<String> {
    if state.running.lock().map_err(|e| e.to_string())?.contains(&id) {
        return Err(AppError::busy("close the game before restoring a world"));
    }
    crate::blocking(move || {
        let safe = content::safe_name(&file)?;
        let (world, _, _) = parse_backup_name(&safe).ok_or_else(|| AppError::invalid("not a world backup"))?;
        let archive_path = backups_dir(&id).join(&safe);
        let saves = saves_dir(&id);
        std::fs::create_dir_all(&saves).map_err(|e| format!("create saves dir: {e}"))?;

        let current = saves.join(&world);
        if current.exists() {
            let aside = saves.join(format!("{world}.before-restore-{}", now_ms()));
            std::fs::rename(&current, &aside).map_err(|e| format!("set the current world aside: {e}"))?;
        }

        let file = std::fs::File::open(&archive_path).map_err(|e| format!("open backup: {e}"))?;
        let mut zip = zip::ZipArchive::new(file).map_err(|e| format!("read backup: {e}"))?;
        for i in 0..zip.len() {
            let mut entry = zip.by_index(i).map_err(|e| format!("read backup entry: {e}"))?;
            let name = entry.name().to_string();
            let target = import::join_safe(&saves, &name)?;
            if entry.is_dir() {
                std::fs::create_dir_all(&target).map_err(|e| format!("restore: {e}"))?;
            } else {
                if let Some(parent) = target.parent() {
                    std::fs::create_dir_all(parent).map_err(|e| format!("restore: {e}"))?;
                }
                let mut out = std::fs::File::create(&target).map_err(|e| format!("restore: {e}"))?;
                std::io::copy(&mut entry, &mut out).map_err(|e| format!("restore: {e}"))?;
            }
        }
        Ok(world)
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::{backups_to_prune, file_name, needs_backup, parse_backup_name, WorldBackup, MIN_GAP_MS};

    fn backup(world: &str, created: i64, auto: bool) -> WorldBackup {
        WorldBackup { file: file_name(world, created, auto), world: world.into(), created, size: 0, auto }
    }

    #[test]
    fn names_round_trip_even_with_underscores_in_the_world_name() {
        let name = file_name("My__World 2", 1700000000000, true);
        assert_eq!(parse_backup_name(&name), Some(("My__World 2".to_string(), 1700000000000, true)));
        assert_eq!(parse_backup_name(&file_name("Survie", 5, false)), Some(("Survie".to_string(), 5, false)));
    }

    #[test]
    fn foreign_files_are_not_backups() {
        assert_eq!(parse_backup_name("notes.txt"), None);
        assert_eq!(parse_backup_name("world.zip"), None);
        assert_eq!(parse_backup_name("w__x__a.zip"), None);
        assert_eq!(parse_backup_name("w__5__z.zip"), None);
        assert_eq!(parse_backup_name("__5__a.zip"), None);
    }

    #[test]
    fn pruning_keeps_the_newest_automatic_ones_and_all_manual_ones() {
        let all = vec![
            backup("A", 1, true),
            backup("A", 2, false),
            backup("A", 3, true),
            backup("A", 4, true),
            backup("B", 1, true),
        ];
        let gone = backups_to_prune(&all, "A", 2);
        assert_eq!(gone, vec![file_name("A", 1, true)]);
        assert!(backups_to_prune(&all, "B", 2).is_empty());
    }

    #[test]
    fn a_world_is_backed_up_when_new_or_changed_and_not_too_recently() {
        let now = 10 * MIN_GAP_MS;
        assert!(needs_backup(5, None, now), "never backed up");
        assert!(!needs_backup(100, Some(200), now), "unchanged since the last backup");
        assert!(!needs_backup(now, Some(now - 1000), now), "changed, but backed up a minute ago");
        assert!(needs_backup(now - 10, Some(now - MIN_GAP_MS - 5), now), "changed and the backup is old");
    }
}
