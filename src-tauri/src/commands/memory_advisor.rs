//! How much RAM to give the game: the machine's memory and the number of mods decide, so the player does
//! not have to guess a number. Also used by the crash analyzer to size an "out of memory" fix.

use serde::Serialize;

use crate::error::AppResult;
use crate::paths;

const STEP_MB: u64 = 512;
const FLOOR_MB: u64 = 2048;
const CEILING_MB: u64 = 16384;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct MemoryAdvice {
    pub recommended_mb: u32,
    pub min_mb: u32,
    pub max_mb: u32,
    pub system_mb: u64,
    pub mods: usize,
    /// "vanilla", "light", "heavy" or "limited" (the machine cannot give what the mods would like).
    pub reason: String,
}

fn round_down(mb: u64) -> u64 {
    mb / STEP_MB * STEP_MB
}

/// What a machine with `total_mb` of RAM should give a game running `mod_count` mods.
pub fn recommend(total_mb: u64, mod_count: usize) -> MemoryAdvice {
    // Leave the rest of the computer room to breathe: 60% of the RAM, 50% on small machines.
    let share = if total_mb < 6144 { 0.5 } else { 0.6 };
    let usable = round_down((total_mb as f64 * share) as u64).max(1024);
    let wanted = if mod_count == 0 { 3072 } else { 3072 + mod_count.min(250) as u64 * 40 };
    let wanted = wanted.clamp(FLOOR_MB, CEILING_MB);
    let recommended = round_down(wanted.min(usable)).max(1024);
    let max = round_down(((total_mb as f64 * 0.75) as u64).min(CEILING_MB)).max(recommended);
    let reason = if wanted > usable {
        "limited"
    } else if mod_count >= 100 {
        "heavy"
    } else if mod_count > 0 {
        "light"
    } else {
        "vanilla"
    };
    MemoryAdvice {
        recommended_mb: recommended as u32,
        min_mb: FLOOR_MB.min(recommended) as u32,
        max_mb: max as u32,
        system_mb: total_mb,
        mods: mod_count,
        reason: reason.into(),
    }
}

/// A bigger allocation for a game that ran out of memory: half as much again (at least 1 GB more),
/// never more than the machine can spare. None when there is no room left to grow.
pub fn raised(current_mb: u32, advice: &MemoryAdvice) -> Option<u32> {
    let bump = (current_mb as u64 / 2).max(1024);
    let target = round_down((current_mb as u64 + bump).min(advice.max_mb as u64));
    (target > current_mb as u64).then_some(target as u32)
}

fn count_mods(instance_id: &str) -> usize {
    let dir = paths::instance_game_dir(instance_id).join("mods");
    std::fs::read_dir(dir)
        .map(|entries| {
            entries
                .flatten()
                .filter(|e| e.file_name().to_string_lossy().to_lowercase().ends_with(".jar"))
                .count()
        })
        .unwrap_or(0)
}

pub fn system_memory_mb() -> u64 {
    let mut sys = sysinfo::System::new();
    sys.refresh_memory();
    sys.total_memory() / (1024 * 1024)
}

pub fn advice_for(instance_id: &str) -> MemoryAdvice {
    recommend(system_memory_mb(), count_mods(instance_id))
}

/// The advice for an instance, or for a game without mods when no instance is given (the global default).
#[tauri::command]
pub async fn recommend_memory(instance_id: Option<String>) -> AppResult<MemoryAdvice> {
    crate::blocking(move || {
        Ok(match instance_id {
            Some(id) => advice_for(&id),
            None => recommend(system_memory_mb(), 0),
        })
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::{raised, recommend};

    #[test]
    fn a_plain_game_on_a_big_machine_gets_a_comfortable_default() {
        let a = recommend(32768, 0);
        assert_eq!(a.recommended_mb, 3072);
        assert_eq!(a.reason, "vanilla");
        assert!(a.max_mb >= 16384 - 512 && a.max_mb <= 16384);
    }

    #[test]
    fn more_mods_ask_for_more_memory() {
        let light = recommend(32768, 20);
        let heavy = recommend(32768, 150);
        assert!(heavy.recommended_mb > light.recommended_mb);
        assert_eq!(light.reason, "light");
        assert_eq!(heavy.reason, "heavy");
        assert_eq!(heavy.recommended_mb % 512, 0);
    }

    #[test]
    fn a_small_machine_never_gives_away_most_of_its_ram() {
        let a = recommend(4096, 80);
        assert!(a.recommended_mb <= 2048, "{}", a.recommended_mb);
        assert_eq!(a.reason, "limited");
        let tiny = recommend(2048, 0);
        assert!(tiny.recommended_mb >= 1024 && tiny.recommended_mb <= 1024);
    }

    #[test]
    fn raising_memory_grows_but_respects_the_machine() {
        let big = recommend(32768, 60);
        assert_eq!(raised(4096, &big), Some(6144));
        assert_eq!(raised(1024, &big), Some(2048));
        let small = recommend(8192, 60);
        assert_eq!(raised(small.max_mb, &small), None, "no room left");
    }
}
