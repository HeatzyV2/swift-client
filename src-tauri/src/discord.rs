use discord_rich_presence::activity::{Activity, ActivityType, Assets, Button, Timestamps};
use discord_rich_presence::{DiscordIpc, DiscordIpcClient};

use crate::models::Loader;
use crate::AppState;

const CLIENT_ID: &str = env!("DISCORD_CLIENT_ID");

/// Art asset key to upload in the Discord Developer Portal
/// (Rich Presence → Art Assets). Use `public/brand/app-icon-256.png`.
const LARGE_IMAGE: &str = "swift";

/// Community invite shown as a Rich Presence button.
const DISCORD_INVITE: &str = "https://discord.gg/elysiasmp";

#[derive(Clone)]
pub struct DiscordSession {
    pub name: String,
    pub mc_version: String,
    pub loader: String,
    pub started_at: i64,
}

/// Rich Presence needs a Discord application id baked in at build time.
pub fn is_configured() -> bool {
    !CLIENT_ID.trim().is_empty()
}

pub fn loader_label(loader: &Loader) -> &'static str {
    match loader {
        Loader::Vanilla => "Vanilla",
        Loader::Fabric(_) => "Fabric",
        Loader::Quilt(_) => "Quilt",
        Loader::Forge(_) => "Forge",
        Loader::NeoForge(_) => "NeoForge",
    }
}

fn now_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn normalize_locale(code: &str) -> String {
    let base = code.split(['-', '_']).next().unwrap_or(code).to_lowercase();
    match base.as_str() {
        "en" | "fr" | "de" | "es" | "pl" | "zh" | "ru" => base,
        _ => "en".into(),
    }
}

fn normalize_screen(screen: &str) -> String {
    match screen {
        "home" | "instances" | "instance" | "social" | "worlds" | "screenshots" | "skins"
        | "settings" => screen.into(),
        _ => "home".into(),
    }
}

struct Copy {
    idle_details: &'static str,
    playing_details: &'static str,
    multi_details: &'static str,
    large_text: &'static str,
    button_discord: &'static str,
}

fn copy_for(locale: &str) -> Copy {
    match locale {
        "fr" => Copy {
            idle_details: "Dans le launcher",
            playing_details: "Joue · {name}",
            multi_details: "Joue sur {n} instances",
            large_text: "Swift Client",
            button_discord: "Rejoindre Discord",
        },
        "de" => Copy {
            idle_details: "Im Launcher",
            playing_details: "Spielt · {name}",
            multi_details: "Spielt auf {n} Instanzen",
            large_text: "Swift Client",
            button_discord: "Discord beitreten",
        },
        "es" => Copy {
            idle_details: "En el launcher",
            playing_details: "Jugando · {name}",
            multi_details: "Jugando en {n} instancias",
            large_text: "Swift Client",
            button_discord: "Unirse a Discord",
        },
        "pl" => Copy {
            idle_details: "W launcherze",
            playing_details: "Gra · {name}",
            multi_details: "Gra na {n} instancjach",
            large_text: "Swift Client",
            button_discord: "Dołącz do Discorda",
        },
        "zh" => Copy {
            idle_details: "在启动器中",
            playing_details: "正在玩 · {name}",
            multi_details: "正在玩 {n} 个实例",
            large_text: "Swift Client",
            button_discord: "加入 Discord",
        },
        "ru" => Copy {
            idle_details: "В лаунчере",
            playing_details: "Играет · {name}",
            multi_details: "Играет на {n} сборках",
            large_text: "Swift Client",
            button_discord: "Войти в Discord",
        },
        _ => Copy {
            idle_details: "In the launcher",
            playing_details: "Playing · {name}",
            multi_details: "Playing {n} instances",
            large_text: "Swift Client",
            button_discord: "Join Discord",
        },
    }
}

fn idle_state(locale: &str, screen: &str) -> &'static str {
    match (locale, screen) {
        ("fr", "home") => "À l'accueil",
        ("fr", "instances") => "Parcourt ses instances",
        ("fr", "instance") => "Sur une instance",
        ("fr", "social") => "Sur Social",
        ("fr", "worlds") => "Parcourt ses mondes",
        ("fr", "screenshots") => "Parcourt ses captures",
        ("fr", "skins") => "Gère ses skins",
        ("fr", "settings") => "Dans les réglages",

        ("de", "home") => "Auf dem Startbildschirm",
        ("de", "instances") => "Durchstöbert Instanzen",
        ("de", "instance") => "Bei einer Instanz",
        ("de", "social") => "In Social",
        ("de", "worlds") => "Durchstöbert Welten",
        ("de", "screenshots") => "Durchstöbert Screenshots",
        ("de", "skins") => "Verwaltet Skins",
        ("de", "settings") => "In den Einstellungen",

        ("es", "home") => "En el inicio",
        ("es", "instances") => "Explorando instancias",
        ("es", "instance") => "En una instancia",
        ("es", "social") => "En Social",
        ("es", "worlds") => "Explorando mundos",
        ("es", "screenshots") => "Explorando capturas",
        ("es", "skins") => "Gestionando skins",
        ("es", "settings") => "En ajustes",

        ("pl", "home") => "Na stronie głównej",
        ("pl", "instances") => "Przegląda instancje",
        ("pl", "instance") => "Przy instancji",
        ("pl", "social") => "W Social",
        ("pl", "worlds") => "Przegląda światy",
        ("pl", "screenshots") => "Przegląda zrzuty",
        ("pl", "skins") => "Zarządza skinami",
        ("pl", "settings") => "W ustawieniach",

        ("zh", "home") => "在主页",
        ("zh", "instances") => "浏览实例",
        ("zh", "instance") => "查看实例",
        ("zh", "social") => "在社交",
        ("zh", "worlds") => "浏览世界",
        ("zh", "screenshots") => "浏览截图",
        ("zh", "skins") => "管理皮肤",
        ("zh", "settings") => "在设置中",

        ("ru", "home") => "На главной",
        ("ru", "instances") => "Просматривает сборки",
        ("ru", "instance") => "У сборки",
        ("ru", "social") => "В Social",
        ("ru", "worlds") => "Просматривает миры",
        ("ru", "screenshots") => "Просматривает скриншоты",
        ("ru", "skins") => "Управляет скинами",
        ("ru", "settings") => "В настройках",

        (_, "home") => "On the home screen",
        (_, "instances") => "Browsing instances",
        (_, "instance") => "Viewing an instance",
        (_, "social") => "On Social",
        (_, "worlds") => "Browsing worlds",
        (_, "screenshots") => "Browsing screenshots",
        (_, "skins") => "Managing skins",
        (_, "settings") => "In settings",
        _ => "On the home screen",
    }
}

fn playing_state_line(loader: &str, mc: &str) -> String {
    format!("{loader} · Minecraft {mc}")
}

fn truncate(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        return s.to_string();
    }
    let mut out: String = s.chars().take(max.saturating_sub(1)).collect();
    out.push('…');
    out
}

fn ensure_client(guard: &mut Option<DiscordIpcClient>) -> Option<&mut DiscordIpcClient> {
    if guard.is_none() {
        if let Ok(mut client) = DiscordIpcClient::new(CLIENT_ID) {
            if client.connect().is_ok() {
                *guard = Some(client);
            }
        }
    }
    guard.as_mut()
}

fn clear_client(guard: &mut Option<DiscordIpcClient>) {
    if let Some(client) = guard.as_mut() {
        let _ = client.clear_activity();
        let _ = client.close();
    }
    *guard = None;
}

/// Sync UI language + current screen into Rich Presence and refresh.
pub fn sync(state: &AppState, locale: &str, screen: &str) {
    if let Ok(mut loc) = state.discord_locale.lock() {
        *loc = normalize_locale(locale);
    }
    if let Ok(mut scr) = state.discord_screen.lock() {
        *scr = normalize_screen(screen);
    }
    update_presence(state);
}

/// Build / refresh Rich Presence from current launcher + game state.
pub fn update_presence(state: &AppState) {
    if !is_configured() {
        return;
    }

    let enabled = crate::commands::settings::load()
        .map(|s| s.discord_rpc)
        .unwrap_or(true);

    let Ok(mut guard) = state.discord.lock() else {
        return;
    };

    if !enabled {
        clear_client(&mut guard);
        return;
    }

    let locale = state
        .discord_locale
        .lock()
        .map(|l| l.clone())
        .unwrap_or_else(|_| "en".into());
    let screen = state
        .discord_screen
        .lock()
        .map(|s| s.clone())
        .unwrap_or_else(|_| "home".into());
    let copy = copy_for(&locale);

    let snapshot: Vec<DiscordSession> = match state.discord_playing.lock() {
        Ok(map) => map.values().cloned().collect(),
        Err(_) => return,
    };

    let Some(client) = ensure_client(&mut guard) else {
        return;
    };

    let assets = Assets::new()
        .large_image(LARGE_IMAGE)
        .large_text(copy.large_text);

    let buttons = vec![Button::new(copy.button_discord, DISCORD_INVITE)];

    if snapshot.is_empty() {
        let idle_since = {
            let mut slot = match state.discord_idle_since.lock() {
                Ok(g) => g,
                Err(_) => return,
            };
            if slot.is_none() {
                *slot = Some(now_secs());
            }
            slot.unwrap_or_else(now_secs)
        };

        let state_line = idle_state(&locale, &screen);
        let activity = Activity::new()
            .activity_type(ActivityType::Playing)
            .details(copy.idle_details)
            .state(state_line)
            .assets(assets)
            .timestamps(Timestamps::new().start(idle_since))
            .buttons(buttons);

        let _ = client.set_activity(activity);
        return;
    }

    // Reset idle clock so the next idle session starts fresh.
    if let Ok(mut idle) = state.discord_idle_since.lock() {
        *idle = None;
    }

    let started_at = snapshot.iter().map(|s| s.started_at).min().unwrap_or_else(now_secs);

    let (details, line) = if snapshot.len() == 1 {
        let s = &snapshot[0];
        let details = copy
            .playing_details
            .replace("{name}", &truncate(&s.name, 96));
        let line = playing_state_line(&s.loader, &s.mc_version);
        (details, line)
    } else {
        let s = &snapshot[0];
        let details = copy
            .multi_details
            .replace("{n}", &snapshot.len().to_string());
        let line = format!(
            "{} · {}",
            truncate(&s.name, 48),
            playing_state_line(&s.loader, &s.mc_version)
        );
        (details, line)
    };

    let activity = Activity::new()
        .activity_type(ActivityType::Playing)
        .details(&details)
        .state(&line)
        .assets(assets)
        .timestamps(Timestamps::new().start(started_at))
        .buttons(buttons);

    let _ = client.set_activity(activity);
}
