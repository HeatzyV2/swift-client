//! Friends + chat. Works locally today; when `SWIFT_BACKEND_URL` is set and a
//! Swift account session exists, the same commands talk to `/api/social/*`.
//!
//! Expected remote surface (for the future backend):
//! ```text
//! GET    /api/social/friends
//! POST   /api/social/friends/request   { username }
//! POST   /api/social/friends/{id}/accept|decline|remove
//! GET    /api/social/conversations
//! GET    /api/social/conversations/{id}/messages?before=&limit=
//! POST   /api/social/conversations/{id}/messages  { text?, media_id? }
//! POST   /api/social/media/upload-url  { size, mime } → { media_id, upload_url }
//! PUT    <upload_url>                 raw image bytes
//! ```

use std::path::{Path, PathBuf};

use base64::Engine;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::{backend, http, paths, store};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FriendKind {
    Microsoft,
    Offline,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FriendStatus {
    PendingIn,
    PendingOut,
    Accepted,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Friend {
    pub id: String,
    pub username: String,
    pub kind: FriendKind,
    #[serde(default)]
    pub uuid: Option<String>,
    pub status: FriendStatus,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub id: String,
    pub conversation_id: String,
    /// Friend id, or `"me"` for messages you sent.
    pub from: String,
    #[serde(default)]
    pub text: Option<String>,
    /// Absolute path of a local image, or a remote https URL once the backend exists.
    #[serde(default)]
    pub image: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub id: String,
    pub friend_id: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct SocialFile {
    #[serde(default)]
    friends: Vec<Friend>,
    #[serde(default)]
    conversations: Vec<Conversation>,
    #[serde(default)]
    messages: Vec<ChatMessage>,
}

fn load() -> AppResult<SocialFile> {
    Ok(store::read_json(&paths::social_file())?.unwrap_or_default())
}

fn save(file: &SocialFile) -> AppResult<()> {
    std::fs::create_dir_all(paths::social_dir()).map_err(|e| e.to_string())?;
    store::write_json(&paths::social_file(), file)
}

fn use_remote() -> bool {
    backend::is_configured() && backend::session_token().is_some()
}

async fn remote_get<T: for<'de> Deserialize<'de>>(path: &str) -> AppResult<T> {
    let url = backend::endpoint(&format!("/api/social{path}"))?;
    let mut req = http().get(&url);
    if let Some(token) = backend::session_token() {
        req = req.bearer_auth(token);
    }
    let res = req.send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("social api {}: {}", res.status(), res.text().await.unwrap_or_default()).into());
    }
    res.json().await.map_err(|e| e.to_string().into())
}

async fn remote_post<B: Serialize, T: for<'de> Deserialize<'de>>(path: &str, body: &B) -> AppResult<T> {
    let url = backend::endpoint(&format!("/api/social{path}"))?;
    let mut req = http().post(&url).json(body);
    if let Some(token) = backend::session_token() {
        req = req.bearer_auth(token);
    }
    let res = req.send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("social api {}: {}", res.status(), res.text().await.unwrap_or_default()).into());
    }
    res.json().await.map_err(|e| e.to_string().into())
}

/// Offline-mode UUID (Java `UUID.nameUUIDFromBytes("OfflinePlayer:"+name)`).
pub fn offline_uuid(username: &str) -> String {
    let data = format!("OfflinePlayer:{username}");
    let digest = md5::compute(data.as_bytes());
    let mut bytes = *digest;
    bytes[6] = (bytes[6] & 0x0f) | 0x30; // version 3
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // IETF variant
    let u = Uuid::from_bytes(bytes);
    u.to_string()
}

async fn resolve_microsoft(username: &str) -> AppResult<(String, String)> {
    let name = username.trim();
    if name.is_empty() || name.len() > 16 {
        return Err("invalid Minecraft username".into());
    }
    let url = format!(
        "https://api.mojang.com/users/profiles/minecraft/{}",
        urlencoding_lite(name)
    );
    let res = http().get(&url).send().await.map_err(|e| e.to_string())?;
    if res.status().as_u16() == 204 || res.status().as_u16() == 404 {
        return Err(format!("no Microsoft account named \"{name}\"").into());
    }
    if !res.status().is_success() {
        return Err(format!("could not look up \"{name}\" ({})", res.status()).into());
    }
    #[derive(Deserialize)]
    struct Profile {
        id: String,
        name: String,
    }
    let p: Profile = res.json().await.map_err(|e| e.to_string())?;
    let uuid = if p.id.contains('-') {
        p.id
    } else {
        format!(
            "{}-{}-{}-{}-{}",
            &p.id[0..8],
            &p.id[8..12],
            &p.id[12..16],
            &p.id[16..20],
            &p.id[20..32]
        )
    };
    Ok((p.name, uuid))
}

fn urlencoding_lite(s: &str) -> String {
    s.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '_' || c == '-' {
                c.to_string()
            } else {
                format!("%{:02X}", c as u8)
            }
        })
        .collect()
}

#[tauri::command]
pub async fn social_list_friends() -> AppResult<Vec<Friend>> {
    if use_remote() {
        return remote_get("/friends").await;
    }
    crate::blocking(|| {
        let mut file = load()?;
        file.friends.sort_by(|a, b| a.username.to_lowercase().cmp(&b.username.to_lowercase()));
        Ok(file.friends)
    })
    .await
}

#[derive(Deserialize)]
pub struct AddFriendArgs {
    pub username: String,
    /// `microsoft` (look up Mojang) or `offline` (cracked).
    pub kind: String,
}

#[tauri::command]
pub async fn social_add_friend(args: AddFriendArgs) -> AppResult<Friend> {
    let kind = match args.kind.to_lowercase().as_str() {
        "offline" | "crack" | "cracked" => FriendKind::Offline,
        _ => FriendKind::Microsoft,
    };
    let username = args.username.trim().to_string();
    if username.is_empty() {
        return Err("enter a username".into());
    }

    if use_remote() {
        #[derive(Serialize)]
        struct Body<'a> {
            username: &'a str,
            kind: &'a str,
        }
        return remote_post(
            "/friends/request",
            &Body {
                username: &username,
                kind: if kind == FriendKind::Offline { "offline" } else { "microsoft" },
            },
        )
        .await;
    }

    let (name, uuid) = match kind {
        FriendKind::Microsoft => {
            let (n, u) = resolve_microsoft(&username).await?;
            (n, Some(u))
        }
        FriendKind::Offline => (username.clone(), Some(offline_uuid(&username))),
    };

    crate::blocking(move || {
        let mut file = load()?;
        if file.friends.iter().any(|f| f.username.eq_ignore_ascii_case(&name)) {
            return Err(format!("\"{name}\" is already in your friends list").into());
        }
        let friend = Friend {
            id: Uuid::new_v4().to_string(),
            username: name,
            kind,
            uuid,
            status: FriendStatus::Accepted,
            created_at: Utc::now().to_rfc3339(),
        };
        file.friends.push(friend.clone());
        // Ensure a conversation exists.
        if !file.conversations.iter().any(|c| c.friend_id == friend.id) {
            file.conversations.push(Conversation {
                id: Uuid::new_v4().to_string(),
                friend_id: friend.id.clone(),
                updated_at: Utc::now().to_rfc3339(),
            });
        }
        save(&file)?;
        Ok(friend)
    })
    .await
}

#[tauri::command]
pub async fn social_remove_friend(id: String) -> AppResult<()> {
    if use_remote() {
        let _: serde_json::Value = remote_post(&format!("/friends/{id}/remove"), &serde_json::json!({})).await?;
        return Ok(());
    }
    crate::blocking(move || {
        let mut file = load()?;
        file.friends.retain(|f| f.id != id);
        let conv_ids: Vec<String> = file
            .conversations
            .iter()
            .filter(|c| c.friend_id == id)
            .map(|c| c.id.clone())
            .collect();
        file.conversations.retain(|c| c.friend_id != id);
        file.messages.retain(|m| !conv_ids.contains(&m.conversation_id));
        save(&file)?;
        Ok(())
    })
    .await
}

#[derive(Serialize, Deserialize)]
pub struct ConversationView {
    pub id: String,
    pub friend: Friend,
    pub updated_at: String,
    pub last_message: Option<ChatMessage>,
}

#[tauri::command]
pub async fn social_list_conversations() -> AppResult<Vec<ConversationView>> {
    if use_remote() {
        return remote_get("/conversations").await;
    }
    crate::blocking(|| {
        let file = load()?;
        let mut out: Vec<ConversationView> = file
            .conversations
            .iter()
            .filter_map(|c| {
                let friend = file.friends.iter().find(|f| f.id == c.friend_id)?.clone();
                let last = file
                    .messages
                    .iter()
                    .filter(|m| m.conversation_id == c.id)
                    .max_by(|a, b| a.created_at.cmp(&b.created_at))
                    .cloned();
                Some(ConversationView {
                    id: c.id.clone(),
                    friend,
                    updated_at: c.updated_at.clone(),
                    last_message: last,
                })
            })
            .collect();
        out.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        Ok(out)
    })
    .await
}

#[tauri::command]
pub async fn social_get_or_create_conversation(friend_id: String) -> AppResult<ConversationView> {
    if use_remote() {
        #[derive(Serialize)]
        struct Body<'a> {
            friend_id: &'a str,
        }
        return remote_post("/conversations", &Body { friend_id: &friend_id }).await;
    }
    crate::blocking(move || {
        let mut file = load()?;
        let friend = file
            .friends
            .iter()
            .find(|f| f.id == friend_id)
            .cloned()
            .ok_or_else(|| AppError::not_found("friend not found"))?;
        let conv = if let Some(c) = file.conversations.iter().find(|c| c.friend_id == friend_id) {
            c.clone()
        } else {
            let c = Conversation {
                id: Uuid::new_v4().to_string(),
                friend_id: friend_id.clone(),
                updated_at: Utc::now().to_rfc3339(),
            };
            file.conversations.push(c.clone());
            save(&file)?;
            c
        };
        let last = file
            .messages
            .iter()
            .filter(|m| m.conversation_id == conv.id)
            .max_by(|a, b| a.created_at.cmp(&b.created_at))
            .cloned();
        Ok(ConversationView {
            id: conv.id,
            friend,
            updated_at: conv.updated_at,
            last_message: last,
        })
    })
    .await
}

#[tauri::command]
pub async fn social_list_messages(conversation_id: String, limit: Option<u32>) -> AppResult<Vec<ChatMessage>> {
    if use_remote() {
        let lim = limit.unwrap_or(100);
        return remote_get(&format!("/conversations/{conversation_id}/messages?limit={lim}")).await;
    }
    crate::blocking(move || {
        let file = load()?;
        let lim = limit.unwrap_or(200) as usize;
        let mut msgs: Vec<ChatMessage> = file
            .messages
            .into_iter()
            .filter(|m| m.conversation_id == conversation_id)
            .collect();
        msgs.sort_by(|a, b| a.created_at.cmp(&b.created_at));
        if msgs.len() > lim {
            msgs = msgs.split_off(msgs.len() - lim);
        }
        Ok(msgs)
    })
    .await
}

#[derive(Deserialize)]
pub struct SendMessageArgs {
    pub conversation_id: String,
    pub text: Option<String>,
    /// Absolute path of an image picked via the dialog (copied into social/media).
    pub image_path: Option<String>,
}

#[tauri::command]
pub async fn social_send_message(args: SendMessageArgs) -> AppResult<ChatMessage> {
    let text = args.text.as_deref().map(str::trim).filter(|s| !s.is_empty()).map(String::from);
    let image_path = args.image_path.filter(|s| !s.trim().is_empty());
    if text.is_none() && image_path.is_none() {
        return Err("message is empty".into());
    }

    if use_remote() {
        // Upload image first when present, then post the message.
        let media_id = if let Some(path) = &image_path {
            Some(upload_remote_image(path).await?)
        } else {
            None
        };
        #[derive(Serialize)]
        struct Body {
            text: Option<String>,
            media_id: Option<String>,
        }
        return remote_post(
            &format!("/conversations/{}/messages", args.conversation_id),
            &Body { text, media_id },
        )
        .await;
    }

    crate::blocking(move || {
        let mut file = load()?;
        if !file.conversations.iter().any(|c| c.id == args.conversation_id) {
            return Err(AppError::not_found("conversation not found"));
        }
        let image = if let Some(src) = image_path {
            Some(store_local_image(&src)?)
        } else {
            None
        };
        let msg = ChatMessage {
            id: Uuid::new_v4().to_string(),
            conversation_id: args.conversation_id.clone(),
            from: "me".into(),
            text,
            image,
            created_at: Utc::now().to_rfc3339(),
        };
        if let Some(c) = file.conversations.iter_mut().find(|c| c.id == args.conversation_id) {
            c.updated_at = msg.created_at.clone();
        }
        file.messages.push(msg.clone());
        save(&file)?;
        Ok(msg)
    })
    .await
}

fn store_local_image(src: &str) -> AppResult<String> {
    let from = PathBuf::from(src);
    if !from.is_file() {
        return Err("image not found".into());
    }
    let ext = from
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_lowercase();
    if !matches!(ext.as_str(), "png" | "jpg" | "jpeg" | "webp" | "gif") {
        return Err("unsupported image type".into());
    }
    let meta = std::fs::metadata(&from).map_err(|e| e.to_string())?;
    if meta.len() > 8 * 1024 * 1024 {
        return Err("image is larger than 8 MB".into());
    }
    std::fs::create_dir_all(paths::social_media_dir()).map_err(|e| e.to_string())?;
    let dest = paths::social_media_dir().join(format!("{}.{}", Uuid::new_v4(), ext));
    std::fs::copy(&from, &dest).map_err(|e| e.to_string())?;
    Ok(dest.to_string_lossy().into_owned())
}

async fn upload_remote_image(path: &str) -> AppResult<String> {
    let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
    if bytes.len() > 8 * 1024 * 1024 {
        return Err("image is larger than 8 MB".into());
    }
    let mime = match Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_lowercase()
        .as_str()
    {
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        _ => "image/png",
    };
    #[derive(Serialize)]
    struct Req {
        size: usize,
        mime: &'static str,
    }
    #[derive(Deserialize)]
    struct Ticket {
        media_id: String,
        upload_url: String,
    }
    let ticket: Ticket = remote_post(
        "/media/upload-url",
        &Req {
            size: bytes.len(),
            mime,
        },
    )
    .await?;
    let put = http()
        .put(&ticket.upload_url)
        .header("Content-Type", mime)
        .body(bytes)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !put.status().is_success() {
        return Err(format!("image upload failed ({})", put.status()).into());
    }
    Ok(ticket.media_id)
}

#[tauri::command]
pub async fn social_mode() -> AppResult<String> {
    Ok(if use_remote() {
        "remote".into()
    } else {
        "local".into()
    })
}

/// Data URL for a chat image path (local files only).
#[tauri::command]
pub async fn social_image_data_url(path: String) -> AppResult<String> {
    crate::blocking(move || {
        let p = PathBuf::from(&path);
        // Only serve files under social/media to avoid arbitrary file reads.
        let media = paths::social_media_dir();
        let canon = p.canonicalize().map_err(|e| e.to_string())?;
        let media_canon = media.canonicalize().unwrap_or(media);
        if !canon.starts_with(&media_canon) {
            return Err("image path not allowed".into());
        }
        let bytes = std::fs::read(&canon).map_err(|e| e.to_string())?;
        let mime = match canon.extension().and_then(|e| e.to_str()).unwrap_or("png") {
            "jpg" | "jpeg" => "image/jpeg",
            "webp" => "image/webp",
            "gif" => "image/gif",
            _ => "image/png",
        };
        let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
        Ok(format!("data:{mime};base64,{b64}"))
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn offline_uuid_is_stable() {
        let a = offline_uuid("Steve");
        let b = offline_uuid("Steve");
        assert_eq!(a, b);
        assert!(a.contains('-'));
    }
}
