use std::io::{Cursor, Read, Write};
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::commands::instances;
use crate::models::{Instance, Loader};
use crate::{paths, store};
use crate::error::{AppError, AppResult};

#[derive(Serialize, Clone)]
pub struct ExternalInstance {
    pub launcher: String,
    pub name: String,
    pub path: String,
    pub game_dir: String,
    pub mc_version: Option<String>,
    pub loader: Option<String>,
    pub loader_version: Option<String>,
}

#[tauri::command]
pub async fn detect_external_instances() -> Vec<ExternalInstance> {
    crate::blocking(|| {
        let mut out = Vec::new();
        out.extend(scan_prism_family());
        out.extend(scan_curseforge());
        out.extend(scan_modrinth());
        out.extend(scan_spectra());
        out.extend(scan_lunar());
        out.extend(scan_dawn());
        Ok(out)
    })
    .await
    .unwrap_or_default()
}

#[tauri::command]
pub async fn import_external_instance(
    name: String,
    game_dir: String,
    mc_version: String,
    loader: Option<String>,
    loader_version: Option<String>,
) -> AppResult<Instance> {
    crate::blocking(move || {
        import_game_dir(name, game_dir, mc_version, loader, loader_version)
    })
    .await
}

fn import_game_dir(
    name: String,
    game_dir: String,
    mc_version: String,
    loader: Option<String>,
    loader_version: Option<String>,
) -> AppResult<Instance> {
    if mc_version.trim().is_empty() {
        return Err("could not determine the Minecraft version of this instance".into());
    }
    let src = PathBuf::from(&game_dir);
    if !src.is_dir() {
        return Err("source game directory not found".into());
    }

    let lver = loader_version.filter(|s| !s.trim().is_empty());
    let loader_enum = build_loader(loader.as_deref(), lver);
    let instance = instances::make_instance(name, mc_version, loader_enum, None, None)?;

    let dst = paths::instance_game_dir(&instance.id);
    if let Err(e) = copy_game_dir(&src, &dst) {
        let _ = std::fs::remove_dir_all(paths::instance_dir(&instance.id));
        return Err(e);
    }
    Ok(instance)
}

#[derive(Serialize, Deserialize)]
struct BackupManifest {
    format: String,
    version: u32,
    instance: Instance,
}

const BACKUP_FORMAT: &str = "swift-instance-backup";
const BACKUP_MANIFEST: &str = "swift-instance.json";
// Backups made by Spectra Launcher, the project Swift Client started from.
const LEGACY_BACKUP_MANIFEST: &str = "spectra-instance.json";

fn has_backup_manifest<R: Read + std::io::Seek>(archive: &mut zip::ZipArchive<R>) -> Option<&'static str> {
    [BACKUP_MANIFEST, LEGACY_BACKUP_MANIFEST]
        .into_iter()
        .find(|name| archive.by_name(name).is_ok())
}

#[derive(Serialize)]
pub struct DirChild {
    name: String,
    is_dir: bool,
    size: u64,
}

const NEVER: &[&str] = &[
    "versions", "libraries", "assets", "bin", "natives", "logs", ".cache",
    ".fabric", ".quilt", ".mixin.out", "asm",
];

#[tauri::command]
pub async fn list_dir(id: String, rel: String) -> AppResult<Vec<DirChild>> {
    crate::blocking(move || dir_children(&id, &rel)).await
}

fn dir_children(id: &str, rel: &str) -> AppResult<Vec<DirChild>> {
    let base = paths::instance_game_dir(id);
    let dir = join_safe(&base, rel)?;
    let mut out = Vec::new();
    for e in std::fs::read_dir(&dir).map_err(|e| format!("read dir: {e}"))?.flatten() {
        let name = e.file_name().to_string_lossy().into_owned();
        if rel.is_empty() && NEVER.contains(&name.to_lowercase().as_str()) {
            continue;
        }
        let path = e.path();
        let is_dir = path.is_dir();
        let size = if is_dir { 0 } else { e.metadata().map(|m| m.len()).unwrap_or(0) };
        out.push(DirChild { name, is_dir, size });
    }
    out.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.to_lowercase().cmp(&b.name.to_lowercase())));
    Ok(out)
}

#[derive(Serialize, Default)]
pub struct DropResult {
    instances: Vec<Instance>,
    added: usize,
    skipped: usize,
}

#[tauri::command]
pub async fn import_dropped(
    app: AppHandle,
    instance_id: Option<String>,
    paths: Vec<String>,
) -> AppResult<DropResult> {
    let mut result = DropResult::default();
    for p in paths {
        let path = PathBuf::from(&p);
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();

        if ext == "mrpack" || (ext == "zip" && is_instance_archive(&path)) {
            match crate::commands::modrinth::import_file(app.clone(), p.clone(), None).await {
                Ok(inst) => result.instances.push(inst),
                Err(_) => result.skipped += 1,
            }
            continue;
        }

        if (ext == "jar" || ext == "zip") && instance_id.is_some() {
            let id = instance_id.as_deref().unwrap();
            if copy_dropped_content(id, &path).is_ok() {
                result.added += 1;
            } else {
                result.skipped += 1;
            }
            continue;
        }
        result.skipped += 1;
    }
    Ok(result)
}

fn is_instance_archive(path: &Path) -> bool {
    let Ok(bytes) = std::fs::read(path) else { return false };
    let Ok(mut z) = zip::ZipArchive::new(Cursor::new(bytes)) else { return false };
    z.by_name("modrinth.index.json").is_ok()
        || z.by_name("manifest.json").is_ok()
        || has_backup_manifest(&mut z).is_some()
}

fn copy_dropped_content(instance_id: &str, path: &Path) -> AppResult<()> {
    let name = path.file_name().map(|n| n.to_string_lossy().into_owned()).ok_or("bad filename")?;
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    let folder = if ext == "jar" { "mods" } else { sniff_zip_folder(path) };
    let dir = paths::instance_game_dir(instance_id).join(folder);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    std::fs::copy(path, dir.join(&name)).map_err(|e| e.to_string())?;
    Ok(())
}

fn sniff_zip_folder(path: &Path) -> &'static str {
    let Ok(bytes) = std::fs::read(path) else { return "resourcepacks" };
    let Ok(mut z) = zip::ZipArchive::new(Cursor::new(bytes)) else { return "resourcepacks" };
    let mut has_data = false;
    let mut has_assets = false;
    for i in 0..z.len() {
        if let Ok(f) = z.by_index(i) {
            let n = f.name();
            if n.starts_with("shaders/") {
                return "shaderpacks";
            }
            if n.starts_with("data/") {
                has_data = true;
            }
            if n.starts_with("assets/") {
                has_assets = true;
            }
        }
    }
    if has_data && !has_assets {
        "datapacks"
    } else {
        "resourcepacks"
    }
}

pub fn is_never_top(name: &str) -> bool {
    NEVER.contains(&name.to_lowercase().as_str())
}

#[tauri::command]
pub async fn write_text_file(path: String, content: String) -> AppResult<()> {
    crate::blocking(move || (std::fs::write(&path, content).map_err(|e| format!("write {path}: {e}"))).map_err(Into::into))
        .await
}

pub struct ExportFilter {
    pub included: std::collections::HashSet<String>,
    pub excluded: std::collections::HashSet<String>,
}

impl ExportFilter {
    pub fn new(include: Vec<String>, exclude: Vec<String>) -> Self {
        Self { included: include.into_iter().collect(), excluded: exclude.into_iter().collect() }
    }

    pub fn includes(&self, rel: &str) -> bool {
        let parts: Vec<&str> = rel.split('/').collect();
        for i in (1..=parts.len()).rev() {
            let p = parts[..i].join("/");
            if self.included.contains(&p) {
                return true;
            }
            if self.excluded.contains(&p) {
                return false;
            }
        }
        true
    }

    pub fn should_descend(&self, dir_rel: &str) -> bool {
        if self.includes(dir_rel) {
            return true;
        }
        let prefix = format!("{dir_rel}/");
        self.included.iter().any(|p| p.starts_with(&prefix))
    }
}

#[tauri::command]
pub async fn export_instance(
    id: String,
    dest: String,
    exclude: Vec<String>,
    include: Vec<String>,
) -> AppResult<()> {
    crate::blocking(move || write_export(&id, &dest, exclude, include)).await
}

fn write_export(
    id: &str,
    dest: &str,
    exclude: Vec<String>,
    include: Vec<String>,
) -> AppResult<()> {
    let instance: Instance =
        store::read_json(&paths::instance_config_file(id))?.ok_or("instance not found")?;
    let game_dir = paths::instance_game_dir(id);
    let filter = ExportFilter::new(include, exclude);

    let file = std::fs::File::create(&dest).map_err(|e| format!("create {dest}: {e}"))?;
    let mut zip = zip::ZipWriter::new(file);
    let opts = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    let manifest = BackupManifest { format: BACKUP_FORMAT.into(), version: 1, instance };
    let manifest_json = serde_json::to_vec_pretty(&manifest).map_err(|e| e.to_string())?;
    zip.start_file(BACKUP_MANIFEST, opts).map_err(|e| e.to_string())?;
    zip.write_all(&manifest_json).map_err(|e| e.to_string())?;

    let icon = paths::instance_icon_file(&id);
    if let Ok(bytes) = std::fs::read(&icon) {
        zip.start_file("icon.png", opts).map_err(|e| e.to_string())?;
        zip.write_all(&bytes).map_err(|e| e.to_string())?;
    }

    zip_game_files(&mut zip, &game_dir, "", &filter, opts)?;
    zip.finish().map_err(|e| e.to_string())?;
    Ok(())
}

fn zip_game_files(
    zip: &mut zip::ZipWriter<std::fs::File>,
    base: &Path,
    rel: &str,
    filter: &ExportFilter,
    opts: zip::write::SimpleFileOptions,
) -> AppResult<()> {
    let dir = if rel.is_empty() { base.to_path_buf() } else { base.join(rel) };
    let Ok(entries) = std::fs::read_dir(&dir) else { return Ok(()) };
    for e in entries.flatten() {
        let name = e.file_name().to_string_lossy().into_owned();
        if rel.is_empty() && NEVER.contains(&name.to_lowercase().as_str()) {
            continue;
        }
        let child_rel = if rel.is_empty() { name.clone() } else { format!("{rel}/{name}") };
        let path = e.path();
        if path.is_dir() {
            if filter.should_descend(&child_rel) {
                zip_game_files(zip, base, &child_rel, filter, opts)?;
            }
        } else if filter.includes(&child_rel) {
            let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
            zip.start_file(format!("minecraft/{child_rel}"), opts).map_err(|e| e.to_string())?;
            zip.write_all(&bytes).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

pub fn is_backup_zip(bytes: &[u8]) -> bool {
    let Ok(mut archive) = zip::ZipArchive::new(Cursor::new(bytes)) else { return false };
    let found = has_backup_manifest(&mut archive).is_some();
    found
}

pub fn restore_backup_from_bytes(bytes: &[u8]) -> AppResult<Instance> {
    let mut archive =
        zip::ZipArchive::new(Cursor::new(bytes)).map_err(|e| format!("open backup: {e}"))?;

    let manifest: BackupManifest = {
        let name = has_backup_manifest(&mut archive).ok_or("not a Swift Client backup")?;
        let mut f = archive.by_name(name).map_err(|e| e.to_string())?;
        let mut s = String::new();
        f.read_to_string(&mut s).map_err(|e| e.to_string())?;
        serde_json::from_str(&s).map_err(|e| format!("parse manifest: {e}"))?
    };
    let src = manifest.instance;

    let created = instances::make_instance(
        src.name.clone(),
        src.mc_version.clone(),
        src.loader.clone(),
        None,
        None,
    )?;
    let new_id = created.id.clone();

    let mut instance = Instance {
        id: new_id.clone(),
        created_at: created.created_at,
        last_played: None,
        playtime_seconds: 0,
        icon: None,
        ..src
    };

    let game_dir = paths::instance_game_dir(&new_id);
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        if entry.is_dir() {
            continue;
        }
        let name = entry.name().to_string();
        if name == "icon.png" {
            let mut buf = Vec::new();
            if entry.read_to_end(&mut buf).is_ok()
                && std::fs::write(paths::instance_icon_file(&new_id), &buf).is_ok()
            {
                instance.icon = Some("icon.png".into());
            }
            continue;
        }
        if let Some(rel) = name.strip_prefix("minecraft/") {
            let dest = join_safe(&game_dir, rel)?;
            if let Some(p) = dest.parent() {
                std::fs::create_dir_all(p).map_err(|e| e.to_string())?;
            }
            let mut buf = Vec::new();
            entry.read_to_end(&mut buf).map_err(|e| e.to_string())?;
            std::fs::write(&dest, &buf).map_err(|e| e.to_string())?;
        }
    }

    store::write_json(&paths::instance_config_file(&new_id), &instance)?;
    Ok(instance)
}

pub fn join_safe(base: &Path, rel: &str) -> AppResult<PathBuf> {
    let mut out = base.to_path_buf();
    for comp in Path::new(rel).components() {
        match comp {
            Component::Normal(c) => out.push(c),
            Component::CurDir => {}
            _ => return Err(AppError::invalid(format!("unsafe path in backup: {rel}"))),
        }
    }
    Ok(out)
}

fn build_loader(loader: Option<&str>, version: Option<String>) -> Loader {
    match loader.unwrap_or("vanilla") {
        "fabric" => Loader::Fabric(version.unwrap_or_default()),
        "quilt" => Loader::Quilt(version.unwrap_or_default()),
        "forge" => Loader::Forge(version.unwrap_or_default()),
        "neoforge" => Loader::NeoForge(version.unwrap_or_default()),
        _ => Loader::Vanilla,
    }
}

const SKIP: &[&str] = &[
    "versions", "libraries", "assets", "bin", "natives", "logs", ".cache",
    ".fabric", ".quilt", ".mixin.out", "asm", "patchouli_books",
];

fn copy_game_dir(src: &Path, dst: &Path) -> AppResult<()> {
    std::fs::create_dir_all(dst).map_err(|e| format!("create dest: {e}"))?;
    for entry in std::fs::read_dir(src).map_err(|e| format!("read source: {e}"))?.flatten() {
        let name = entry.file_name();
        let lower = name.to_string_lossy().to_lowercase();
        if SKIP.contains(&lower.as_str()) {
            continue;
        }
        let from = entry.path();
        let to = dst.join(&name);
        if from.is_dir() {
            copy_dir_all(&from, &to)?;
        } else {
            std::fs::copy(&from, &to).map_err(|e| format!("copy {}: {e}", from.display()))?;
        }
    }
    Ok(())
}

fn copy_dir_all(src: &Path, dst: &Path) -> AppResult<()> {
    if instances::clone_dir(src, dst) {
        return Ok(());
    }
    std::fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    for entry in std::fs::read_dir(src).map_err(|e| e.to_string())?.flatten() {
        let from = entry.path();
        let to = dst.join(entry.file_name());
        if from.is_dir() {
            copy_dir_all(&from, &to)?;
        } else {
            std::fs::copy(&from, &to).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn scan_prism_family() -> Vec<ExternalInstance> {
    let mut out = Vec::new();
    let mut roots: Vec<(PathBuf, &'static str)> = Vec::new();

    if let Some(data) = dirs::data_dir() {
        roots.push((data.join("PrismLauncher").join("instances"), "prism"));
        roots.push((data.join("PolyMC").join("instances"), "polymc"));
        roots.push((data.join("MultiMC").join("instances"), "multimc"));
    }

    #[cfg(target_os = "macos")]
    if let Some(home) = dirs::home_dir() {
        let share = home.join(".local").join("share");
        roots.push((share.join("PrismLauncher").join("instances"), "prism"));
        roots.push((share.join("PolyMC").join("instances"), "polymc"));
        roots.push((share.join("MultiMC").join("instances"), "multimc"));
    }

    #[cfg(target_os = "linux")]
    if let Some(home) = dirs::home_dir() {
        let share = home.join(".local").join("share");
        roots.push((share.join("PrismLauncher").join("instances"), "prism"));
        roots.push((share.join("PolyMC").join("instances"), "polymc"));
        roots.push((share.join("MultiMC").join("instances"), "multimc"));
        // Flatpak Prism
        roots.push((
            home
                .join(".var")
                .join("app")
                .join("org.prismlauncher.PrismLauncher")
                .join("data")
                .join("PrismLauncher")
                .join("instances"),
            "prism",
        ));
    }

    for (root, launcher) in roots {
        let Ok(entries) = std::fs::read_dir(&root) else { continue };
        for e in entries.flatten() {
            let dir = e.path();
            let pack = dir.join("mmc-pack.json");
            if !dir.is_dir() || !pack.exists() {
                continue;
            }
            let game = if dir.join(".minecraft").is_dir() {
                dir.join(".minecraft")
            } else if dir.join("minecraft").is_dir() {
                dir.join("minecraft")
            } else {
                continue;
            };
            let name = read_cfg_value(&dir.join("instance.cfg"), "name")
                .unwrap_or_else(|| dir_name(&dir));
            let (mc, loader, lver) = parse_mmc_pack(&pack);
            let path = dir.to_string_lossy().into_owned();
            if out.iter().any(|x: &ExternalInstance| x.path == path) {
                continue;
            }
            out.push(ExternalInstance {
                launcher: launcher.into(),
                name,
                path,
                game_dir: game.to_string_lossy().into_owned(),
                mc_version: mc,
                loader,
                loader_version: lver,
            });
        }
    }
    out
}

fn parse_mmc_pack(path: &Path) -> (Option<String>, Option<String>, Option<String>) {
    let Ok(raw) = std::fs::read_to_string(path) else { return (None, None, None) };
    let Ok(val) = serde_json::from_str::<serde_json::Value>(&raw) else { return (None, None, None) };
    let (mut mc, mut loader, mut lver) = (None, None, None);
    if let Some(comps) = val.get("components").and_then(|c| c.as_array()) {
        for c in comps {
            let uid = c.get("uid").and_then(|u| u.as_str()).unwrap_or("");
            let ver = c.get("version").and_then(|v| v.as_str()).map(String::from);
            match uid {
                "net.minecraft" => mc = ver,
                "net.fabricmc.fabric-loader" => { loader = Some("fabric".into()); lver = ver; }
                "org.quiltmc.quilt-loader" => { loader = Some("quilt".into()); lver = ver; }
                "net.minecraftforge" => { loader = Some("forge".into()); lver = ver; }
                "net.neoforged" => { loader = Some("neoforge".into()); lver = ver; }
                _ => {}
            }
        }
    }
    (mc, loader, lver)
}

fn read_cfg_value(path: &Path, key: &str) -> Option<String> {
    let raw = std::fs::read_to_string(path).ok()?;
    for line in raw.lines() {
        if let Some((k, v)) = line.split_once('=') {
            if k.trim() == key {
                let v = v.trim();
                if !v.is_empty() {
                    return Some(v.to_string());
                }
            }
        }
    }
    None
}

fn scan_curseforge() -> Vec<ExternalInstance> {
    let mut out = Vec::new();
    let mut roots = Vec::new();
    if let Some(d) = dirs::document_dir() {
        roots.push(d.join("Curseforge").join("Minecraft").join("Instances"));
    }
    if let Some(h) = dirs::home_dir() {
        roots.push(h.join("curseforge").join("minecraft").join("Instances"));
    }
    for root in roots {
        let Ok(entries) = std::fs::read_dir(&root) else { continue };
        for e in entries.flatten() {
            let dir = e.path();
            let meta = dir.join("minecraftinstance.json");
            if !dir.is_dir() || !meta.exists() {
                continue;
            }
            let (name, mc, loader, lver) = parse_cf(&meta);
            out.push(ExternalInstance {
                launcher: "curseforge".into(),
                name: name.unwrap_or_else(|| dir_name(&dir)),
                game_dir: dir.to_string_lossy().into_owned(),
                path: dir.to_string_lossy().into_owned(),
                mc_version: mc,
                loader,
                loader_version: lver,
            });
        }
    }
    out
}

fn parse_cf(path: &Path) -> (Option<String>, Option<String>, Option<String>, Option<String>) {
    let Ok(raw) = std::fs::read_to_string(path) else { return (None, None, None, None) };
    let Ok(v) = serde_json::from_str::<serde_json::Value>(&raw) else { return (None, None, None, None) };
    let name = v.get("name").and_then(|x| x.as_str()).map(String::from);
    let mc = v
        .get("gameVersion")
        .and_then(|x| x.as_str())
        .map(String::from)
        .or_else(|| {
            v.get("baseModLoader")
                .and_then(|b| b.get("minecraftVersion"))
                .and_then(|x| x.as_str())
                .map(String::from)
        });
    let (loader, lver) = v
        .get("baseModLoader")
        .and_then(|b| b.get("name"))
        .and_then(|x| x.as_str())
        .map(parse_cf_loader)
        .unwrap_or((None, None));
    (name, mc, loader, lver)
}

fn parse_cf_loader(name: &str) -> (Option<String>, Option<String>) {
    let (kind, ver) = name.split_once('-').unwrap_or((name, ""));
    let loader = match kind.to_lowercase().as_str() {
        "forge" => "forge",
        "fabric" => "fabric",
        "neoforge" => "neoforge",
        "quilt" => "quilt",
        _ => return (None, None),
    };
    (Some(loader.into()), (!ver.is_empty()).then(|| ver.to_string()))
}

fn scan_modrinth() -> Vec<ExternalInstance> {
    let mut out = Vec::new();
    let Some(data) = dirs::data_dir() else { return out };
    for app in ["ModrinthApp", "com.modrinth.theseus"] {
        let root = data.join(app).join("profiles");
        let Ok(entries) = std::fs::read_dir(&root) else { continue };
        for e in entries.flatten() {
            let dir = e.path();
            let meta = dir.join("profile.json");
            if !dir.is_dir() || !meta.exists() {
                continue;
            }
            let (name, mc, loader, lver) = parse_modrinth_profile(&meta, &dir_name(&dir));
            out.push(ExternalInstance {
                launcher: "modrinth".into(),
                name,
                game_dir: dir.to_string_lossy().into_owned(),
                path: dir.to_string_lossy().into_owned(),
                mc_version: mc,
                loader,
                loader_version: lver,
            });
        }
    }
    out
}

fn parse_modrinth_profile(
    path: &Path,
    fallback: &str,
) -> (String, Option<String>, Option<String>, Option<String>) {
    let Ok(raw) = std::fs::read_to_string(path) else { return (fallback.into(), None, None, None) };
    let Ok(v) = serde_json::from_str::<serde_json::Value>(&raw) else { return (fallback.into(), None, None, None) };
    let meta = v.get("metadata").unwrap_or(&v);
    let name = meta.get("name").and_then(|x| x.as_str()).map(String::from).unwrap_or_else(|| fallback.into());
    let mc = meta.get("game_version").and_then(|x| x.as_str()).map(String::from);
    let loader = meta
        .get("loader")
        .and_then(|x| x.as_str())
        .map(|s| s.to_lowercase())
        .filter(|s| s != "vanilla");
    let lver = meta.get("loader_version").and_then(|lv| {
        lv.as_str()
            .map(String::from)
            .or_else(|| lv.get("id").and_then(|i| i.as_str()).map(String::from))
    });
    (name, mc, loader, lver)
}

/// Spectra Launcher (Swift's upstream) — same layout as Swift Client.
fn scan_spectra() -> Vec<ExternalInstance> {
    let mut out = Vec::new();
    let mut roots = Vec::new();
    if let Some(data) = dirs::data_dir() {
        roots.push(data.join("SpectraLauncher").join("instances"));
        roots.push(data.join("Spectra").join("instances"));
    }
    if let Ok(custom) = std::env::var("SPECTRA_DATA_DIR") {
        if !custom.trim().is_empty() {
            roots.push(PathBuf::from(custom).join("instances"));
        }
    }
    for root in roots {
        scan_swift_like_instances(&root, "spectra", &mut out);
    }
    out
}

fn scan_swift_like_instances(root: &Path, launcher: &str, out: &mut Vec<ExternalInstance>) {
    let Ok(entries) = std::fs::read_dir(root) else { return };
    for e in entries.flatten() {
        let dir = e.path();
        let meta = dir.join("instance.json");
        if !dir.is_dir() || !meta.exists() {
            continue;
        }
        let game = if dir.join("minecraft").is_dir() {
            dir.join("minecraft")
        } else if dir.join(".minecraft").is_dir() {
            dir.join(".minecraft")
        } else {
            continue;
        };
        let (name, mc, loader, lver) = parse_swift_like_instance(&meta, &dir_name(&dir));
        let path = dir.to_string_lossy().into_owned();
        if out.iter().any(|x| x.path == path) {
            continue;
        }
        out.push(ExternalInstance {
            launcher: launcher.into(),
            name,
            path,
            game_dir: game.to_string_lossy().into_owned(),
            mc_version: mc,
            loader,
            loader_version: lver,
        });
    }
}

fn parse_swift_like_instance(
    path: &Path,
    fallback: &str,
) -> (String, Option<String>, Option<String>, Option<String>) {
    let Ok(raw) = std::fs::read_to_string(path) else {
        return (fallback.into(), None, None, None);
    };
    let Ok(v) = serde_json::from_str::<serde_json::Value>(&raw) else {
        return (fallback.into(), None, None, None);
    };
    let name = v
        .get("name")
        .and_then(|x| x.as_str())
        .map(String::from)
        .unwrap_or_else(|| fallback.into());
    let mc = v.get("mc_version").and_then(|x| x.as_str()).map(String::from);
    let (loader, lver) = v
        .get("loader")
        .map(|l| {
            let kind = l
                .get("type")
                .and_then(|t| t.as_str())
                .unwrap_or("vanilla")
                .to_lowercase();
            let ver = l
                .get("version")
                .and_then(|x| x.as_str())
                .map(String::from)
                .filter(|s| !s.is_empty());
            match kind.as_str() {
                "fabric" | "quilt" | "forge" | "neoforge" => (Some(kind), ver),
                _ => (None, None),
            }
        })
        .unwrap_or((None, None));
    (name, mc, loader, lver)
}

/// Lunar Client — profiles under `~/.lunarclient/profiles`.
fn scan_lunar() -> Vec<ExternalInstance> {
    let mut out = Vec::new();
    let Some(home) = dirs::home_dir() else { return out };
    let root = home.join(".lunarclient");
    if !root.is_dir() {
        return out;
    }

    // Modpack / custom profiles (preferred — each is a full game dir).
    let profiles = root.join("profiles");
    if let Ok(entries) = std::fs::read_dir(&profiles) {
        for e in entries.flatten() {
            let dir = e.path();
            if !dir.is_dir() || !looks_like_game_dir(&dir) {
                continue;
            }
            let (mc, loader, lver) = infer_lunar_meta(&dir);
            let name = read_json_str(&dir.join("profile.json"), &["name", "displayName"])
                .or_else(|| read_json_str(&dir.join("metadata.json"), &["name", "displayName"]))
                .unwrap_or_else(|| dir_name(&dir));
            push_unique(
                &mut out,
                ExternalInstance {
                    launcher: "lunar".into(),
                    name,
                    path: dir.to_string_lossy().into_owned(),
                    game_dir: dir.to_string_lossy().into_owned(),
                    mc_version: mc,
                    loader,
                    loader_version: lver,
                },
            );
        }
    }

    // Offline multiver caches sometimes hold a usable game tree per version.
    let multiver = root.join("offline").join("multiver");
    if let Ok(entries) = std::fs::read_dir(&multiver) {
        for e in entries.flatten() {
            let dir = e.path();
            if !dir.is_dir() || !looks_like_game_dir(&dir) {
                continue;
            }
            let folder = dir_name(&dir);
            let mc = guess_mc_version(&folder);
            push_unique(
                &mut out,
                ExternalInstance {
                    launcher: "lunar".into(),
                    name: format!("Lunar {folder}"),
                    path: dir.to_string_lossy().into_owned(),
                    game_dir: dir.to_string_lossy().into_owned(),
                    mc_version: mc,
                    loader: None,
                    loader_version: None,
                },
            );
        }
    }

    out
}

fn infer_lunar_meta(dir: &Path) -> (Option<String>, Option<String>, Option<String>) {
    for file in ["profile.json", "metadata.json", "version.json", "instance.json"] {
        let path = dir.join(file);
        let Ok(raw) = std::fs::read_to_string(&path) else { continue };
        let Ok(v) = serde_json::from_str::<serde_json::Value>(&raw) else { continue };
        let mc = [
            "version",
            "gameVersion",
            "minecraftVersion",
            "mcVersion",
            "mc_version",
        ]
        .iter()
        .find_map(|k| v.get(k).and_then(|x| x.as_str()).map(String::from))
        .or_else(|| {
            v.get("version")
                .and_then(|x| x.get("id"))
                .and_then(|x| x.as_str())
                .map(String::from)
        });
        let loader_raw = ["loader", "modLoader", "module"]
            .iter()
            .find_map(|k| v.get(k).and_then(|x| x.as_str()))
            .map(|s| s.to_lowercase());
        let (loader, lver) = match loader_raw.as_deref() {
            Some("fabric") => (Some("fabric".into()), None),
            Some("forge") => (Some("forge".into()), None),
            Some("quilt") => (Some("quilt".into()), None),
            Some("neoforge") => (Some("neoforge".into()), None),
            _ => (None, None),
        };
        if mc.is_some() {
            return (mc, loader, lver);
        }
    }
    (guess_mc_version(&dir_name(dir)), None, None)
}

/// Dawn Client (ex-Feather) — probe common data roots.
fn scan_dawn() -> Vec<ExternalInstance> {
    let mut out = Vec::new();
    let mut roots = Vec::new();

    if let Some(home) = dirs::home_dir() {
        roots.push(home.join(".dawn"));
        roots.push(home.join(".dawnclient"));
        roots.push(home.join(".feather"));
    }
    if let Some(data) = dirs::data_dir() {
        for name in [
            "Dawn",
            "DawnClient",
            "Dawn Client",
            "dawn-client",
            "DawnLauncher",
            "feather",
            "FeatherClient",
            "Feather",
        ] {
            roots.push(data.join(name));
        }
    }
    if let Some(local) = dirs::data_local_dir() {
        for name in ["Dawn", "DawnClient", "Dawn Client", "feather", "FeatherClient"] {
            roots.push(local.join(name));
        }
    }

    for root in roots {
        if !root.is_dir() {
            continue;
        }
        // Direct instance folders
        for sub in ["instances", "profiles", "installations", "game-dirs", "games"] {
            let dir = root.join(sub);
            if dir.is_dir() {
                scan_generic_instance_root(&dir, "dawn", &mut out);
            }
        }
        // Root itself may hold versioned game dirs
        scan_generic_instance_root(&root, "dawn", &mut out);
    }
    out
}

fn scan_generic_instance_root(root: &Path, launcher: &str, out: &mut Vec<ExternalInstance>) {
    let Ok(entries) = std::fs::read_dir(root) else { return };
    for e in entries.flatten() {
        let dir = e.path();
        if !dir.is_dir() {
            continue;
        }
        // Skip shared caches
        let name = dir_name(&dir).to_lowercase();
        if matches!(
            name.as_str(),
            "assets" | "libraries" | "versions" | "cache" | "logs" | "jre" | "java" | "natives" | "bin"
        ) {
            continue;
        }

        let game = if looks_like_game_dir(&dir) {
            dir.clone()
        } else if looks_like_game_dir(&dir.join(".minecraft")) {
            dir.join(".minecraft")
        } else if looks_like_game_dir(&dir.join("minecraft")) {
            dir.join("minecraft")
        } else {
            continue;
        };

        // Prefer structured metadata when present (Swift/Spectra-like).
        let meta = dir.join("instance.json");
        let (iname, mc, loader, lver) = if meta.exists() {
            parse_swift_like_instance(&meta, &dir_name(&dir))
        } else if dir.join("mmc-pack.json").exists() {
            let (mc, loader, lver) = parse_mmc_pack(&dir.join("mmc-pack.json"));
            let name = read_cfg_value(&dir.join("instance.cfg"), "name")
                .unwrap_or_else(|| dir_name(&dir));
            (name, mc, loader, lver)
        } else if dir.join("profile.json").exists() {
            parse_modrinth_profile(&dir.join("profile.json"), &dir_name(&dir))
        } else {
            let folder = dir_name(&dir);
            (folder.clone(), guess_mc_version(&folder), None, None)
        };

        push_unique(
            out,
            ExternalInstance {
                launcher: launcher.into(),
                name: iname,
                path: dir.to_string_lossy().into_owned(),
                game_dir: game.to_string_lossy().into_owned(),
                mc_version: mc,
                loader,
                loader_version: lver,
            },
        );
    }
}

fn looks_like_game_dir(p: &Path) -> bool {
    p.join("saves").is_dir()
        || p.join("mods").is_dir()
        || p.join("options.txt").is_file()
        || p.join("resourcepacks").is_dir()
        || p.join("shaderpacks").is_dir()
        || p.join("config").is_dir()
}

fn guess_mc_version(s: &str) -> Option<String> {
    // Match 1.20.1 / 1.8.9 / 1.21 embedded in folder names.
    let re = regex_lite_version(s)?;
    Some(re)
}

fn regex_lite_version(s: &str) -> Option<String> {
    let bytes = s.as_bytes();
    let mut i = 0;
    while i + 3 < bytes.len() {
        if bytes[i] == b'1' && bytes[i + 1] == b'.' {
            let mut j = i + 2;
            let mut dots = 0;
            let mut ok = true;
            while j < bytes.len() {
                let c = bytes[j];
                if c.is_ascii_digit() {
                    j += 1;
                } else if c == b'.' {
                    dots += 1;
                    if dots > 2 {
                        ok = false;
                        break;
                    }
                    j += 1;
                } else {
                    break;
                }
            }
            if ok && j > i + 3 {
                let cand = &s[i..j];
                // Require at least 1.x
                if cand.matches('.').count() >= 1 {
                    return Some(cand.to_string());
                }
            }
        }
        i += 1;
    }
    None
}

fn read_json_str(path: &Path, keys: &[&str]) -> Option<String> {
    let raw = std::fs::read_to_string(path).ok()?;
    let v: serde_json::Value = serde_json::from_str(&raw).ok()?;
    keys.iter()
        .find_map(|k| v.get(k).and_then(|x| x.as_str()).map(String::from))
}

fn push_unique(out: &mut Vec<ExternalInstance>, item: ExternalInstance) {
    if out.iter().any(|x| x.path == item.path || x.game_dir == item.game_dir) {
        return;
    }
    out.push(item);
}

fn dir_name(p: &Path) -> String {
    p.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default()
}
