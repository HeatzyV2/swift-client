//! Reads a crash report or a game log and says what probably went wrong, in terms the player can act on.
//!
//! The rules look for the well-known signatures (out of memory, wrong Java, a missing dependency, a broken
//! mixin, a graphics driver...). Each finding has a stable id the UI translates, optional arguments (mod
//! names...) and sometimes a one-click fix.

use serde::Serialize;

use crate::commands::{client_mod, import, memory_advisor, settings};
use crate::error::{AppError, AppResult};
use crate::paths;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct Fix {
    /// "raise_memory", "lower_memory", "rollback_mod", "open_mods" or "open_java".
    pub kind: String,
    pub value: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct Finding {
    pub id: String,
    pub args: Vec<String>,
    pub fix: Option<Fix>,
}

fn finding(id: &str, args: Vec<String>, fix: Option<&str>) -> Finding {
    Finding { id: id.into(), args, fix: fix.map(|k| Fix { kind: k.into(), value: None }) }
}

/// The text between the first pair of single quotes of a line: `Mod 'Sodium' (sodium) 1.0 requires...`.
fn quoted(line: &str) -> Option<String> {
    let start = line.find('\'')? + 1;
    let end = line[start..].find('\'')? + start;
    Some(line[start..end].to_string())
}

/// What a Fabric "requires X, which is missing" line asks for: `any version of fabric-api` -> `fabric-api`.
fn required_dependency(line: &str) -> Option<String> {
    let after = line.split("requires").nth(1)?;
    let wanted = after.split(", which").next()?.trim();
    let wanted = wanted.rsplit(" of ").next().unwrap_or(wanted).trim();
    (!wanted.is_empty()).then(|| wanted.to_string())
}

/// The mod id in `Mixin apply for mod sodium failed ...`.
fn mixin_mod(line: &str) -> Option<String> {
    let after = line.split("Mixin apply for mod ").nth(1)?;
    let id = after.split_whitespace().next()?;
    (!id.is_empty()).then(|| id.to_string())
}

pub fn analyze(text: &str) -> Vec<Finding> {
    let mut out: Vec<Finding> = Vec::new();
    let mut push = |f: Finding| {
        if !out.contains(&f) {
            out.push(f);
        }
    };

    if text.contains("java.lang.OutOfMemoryError") {
        let kind = if text.contains("Metaspace") { "metaspace" } else { "heap" };
        push(finding("out_of_memory", vec![kind.into()], Some("raise_memory")));
    }
    if text.contains("Could not reserve enough space for object heap") || text.contains("Invalid maximum heap size") {
        push(finding("heap_too_big", vec![], Some("lower_memory")));
    }
    if text.contains("UnsupportedClassVersionError") || text.contains("compiled by a more recent version of the Java Runtime") {
        push(finding("java_too_old", vec![], Some("open_java")));
    }

    let mut swift_mixin = false;
    for line in text.lines() {
        if line.contains("requires") && line.contains("which is missing") {
            let who = quoted(line).unwrap_or_else(|| "?".into());
            let dep = required_dependency(line).unwrap_or_else(|| "?".into());
            push(finding("missing_dependency", vec![who, dep], Some("open_mods")));
        } else if line.contains("requires") && line.contains("wrong version is present") {
            let who = quoted(line).unwrap_or_else(|| "?".into());
            let dep = required_dependency(line).unwrap_or_else(|| "?".into());
            push(finding("wrong_version", vec![who, dep], Some("open_mods")));
        }

        if let Some(id) = mixin_mod(line) {
            if id == "swiftclient" {
                swift_mixin = true;
            } else {
                push(finding("mixin_failed", vec![id], Some("open_mods")));
            }
        }
    }

    let swift_in_trace = text.lines().any(|l| l.trim_start().starts_with("at dev.swiftclient.")) && text.contains("Exception");
    if swift_mixin || swift_in_trace {
        push(finding("swift_mod_crash", vec![], Some("rollback_mod")));
    }

    if text.contains("GLFW error 65542")
        || text.contains("WGL: The driver does not appear to support OpenGL")
        || text.contains("Pixel format not accelerated")
        || text.contains("GLFW error 65543")
    {
        push(finding("graphics_driver", vec![], None));
    }
    if text.contains("java.lang.StackOverflowError") {
        push(finding("stack_overflow", vec![], Some("open_mods")));
    }
    if text.contains("No space left on device") || text.contains("There is not enough space on the disk") {
        push(finding("disk_full", vec![], None));
    }

    out
}

/// Fills in the values of the fixes that depend on this computer and this instance.
fn resolve_fixes(findings: &mut [Finding], current_mb: u32, advice: &memory_advisor::MemoryAdvice, previous_mod: Option<String>) {
    for f in findings.iter_mut() {
        let Some(fix) = f.fix.as_mut() else { continue };
        match fix.kind.as_str() {
            "raise_memory" => match memory_advisor::raised(current_mb, advice) {
                Some(mb) => fix.value = Some(mb.to_string()),
                None => {
                    // The machine has nothing left to give: say so instead of offering a useless button.
                    f.id = "out_of_memory_maxed".into();
                    f.fix = None;
                }
            },
            "lower_memory" => {
                let target = (advice.recommended_mb).min(current_mb.saturating_sub(1024)).max(1024);
                fix.value = Some(target.to_string());
            }
            "rollback_mod" => match &previous_mod {
                Some(v) => fix.value = Some(v.clone()),
                None => f.fix = None,
            },
            _ => {}
        }
    }
}

/// The newest mod version that is older than the one in use and is on this computer.
fn previous_mod_version() -> Option<String> {
    let status = client_mod::current_status_snapshot();
    let installed = status.installed?;
    status
        .versions
        .into_iter()
        .map(|v| v.version)
        .filter(|v| *v != installed && client_mod::is_newer_version(v, &installed))
        .max_by_key(|v| client_mod::version_key(v))
}

fn read_capped(path: &std::path::Path, max: usize) -> AppResult<String> {
    let bytes = std::fs::read(path).map_err(|e| format!("read: {e}"))?;
    let slice = if bytes.len() > max { &bytes[bytes.len() - max..] } else { &bytes[..] };
    Ok(String::from_utf8_lossy(slice).into_owned())
}

/// Analyzes a crash report (`rel` under the instance's game folder), or the latest log when none is given.
#[tauri::command]
pub async fn analyze_crash(instance_id: String, rel: Option<String>) -> AppResult<Vec<Finding>> {
    crate::blocking(move || {
        let game = paths::instance_game_dir(&instance_id);
        let path = match rel.as_deref() {
            Some(r) if r.starts_with("crash-reports/") || r.starts_with("logs/") => import::join_safe(&game, r)?,
            Some(_) => return Err(AppError::invalid("invalid report path")),
            None => game.join("logs").join("latest.log"),
        };
        let text = read_capped(&path, 1_500_000)?;
        let mut findings = analyze(&text);

        let instance: crate::models::Instance =
            crate::store::read_json(&paths::instance_config_file(&instance_id))?.ok_or("instance not found")?;
        let default_mb = settings::load().map(|s| s.default_memory_mb).unwrap_or(4096);
        let current_mb = (if instance.override_memory { instance.memory_mb } else { None }).unwrap_or(default_mb);
        let advice = memory_advisor::advice_for(&instance_id);
        resolve_fixes(&mut findings, current_mb, &advice, previous_mod_version());
        Ok(findings)
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::{analyze, resolve_fixes};
    use crate::commands::memory_advisor::recommend;

    fn ids(text: &str) -> Vec<String> {
        analyze(text).into_iter().map(|f| f.id).collect()
    }

    #[test]
    fn out_of_memory_is_recognised_with_its_kind() {
        let f = analyze("Caused by: java.lang.OutOfMemoryError: Java heap space\n at foo");
        assert_eq!(f.len(), 1);
        assert_eq!(f[0].id, "out_of_memory");
        assert_eq!(f[0].args, vec!["heap".to_string()]);
        assert_eq!(f[0].fix.as_ref().map(|x| x.kind.as_str()), Some("raise_memory"));
        assert_eq!(analyze("java.lang.OutOfMemoryError: Metaspace")[0].args, vec!["metaspace".to_string()]);
    }

    #[test]
    fn a_missing_fabric_dependency_names_the_mod_and_what_it_needs() {
        let log = "Some of your mods are incompatible\n\t - Mod 'Sodium Extra' (sodium-extra) 0.6 requires any version of sodium, which is missing!\n";
        let f = analyze(log);
        assert_eq!(f.len(), 1);
        assert_eq!(f[0].id, "missing_dependency");
        assert_eq!(f[0].args, vec!["Sodium Extra".to_string(), "sodium".to_string()]);
    }

    #[test]
    fn a_wrong_version_is_told_apart_from_a_missing_one() {
        let log = "- Mod 'Foo' (foo) 1.0 requires version 1.21 of minecraft, but only the wrong version is present: 26.2!";
        assert_eq!(ids(log), vec!["wrong_version".to_string()]);
    }

    #[test]
    fn a_broken_mixin_blames_the_right_mod_and_the_swift_mod_gets_a_rollback() {
        let other = analyze("Mixin apply for mod sodium failed sodium.mixins.json:Foo -> net.Bar: InvalidMixinException");
        assert_eq!(other[0].id, "mixin_failed");
        assert_eq!(other[0].args, vec!["sodium".to_string()]);
        let swift = analyze("Mixin apply for mod swiftclient failed swiftclient.client.mixins.json:ChatComponentMixin");
        assert_eq!(swift[0].id, "swift_mod_crash");
        assert_eq!(swift[0].fix.as_ref().map(|x| x.kind.as_str()), Some("rollback_mod"));
    }

    #[test]
    fn the_swift_mod_in_a_stack_trace_is_enough() {
        let log = "java.lang.NullPointerException: x\n\tat dev.swiftclient.modules.AuraModule.onTick(AuraModule.java:60)\n";
        assert_eq!(ids(log), vec!["swift_mod_crash".to_string()]);
        assert!(ids("Exception in foo\n\tat net.minecraft.Bar.run(Bar.java:1)").is_empty());
    }

    #[test]
    fn driver_disk_java_and_heap_problems() {
        assert_eq!(ids("GLFW error 65542: WGL: The driver does not appear to support OpenGL"), vec!["graphics_driver".to_string()]);
        assert_eq!(ids("java.io.IOException: No space left on device"), vec!["disk_full".to_string()]);
        assert_eq!(ids("java.lang.UnsupportedClassVersionError: class has been compiled by a more recent version"), vec!["java_too_old".to_string()]);
        assert_eq!(ids("Error occurred during initialization of VM\nCould not reserve enough space for object heap"), vec!["heap_too_big".to_string()]);
        assert!(ids("Everything is fine").is_empty());
    }

    #[test]
    fn the_same_problem_is_reported_once() {
        let log = "java.lang.OutOfMemoryError: Java heap space\njava.lang.OutOfMemoryError: Java heap space";
        assert_eq!(analyze(log).len(), 1);
    }

    #[test]
    fn fixes_get_values_from_this_machine_and_drop_when_pointless() {
        let advice = recommend(32768, 40);
        let mut f = analyze("java.lang.OutOfMemoryError: Java heap space");
        resolve_fixes(&mut f, 4096, &advice, None);
        assert_eq!(f[0].fix.as_ref().and_then(|x| x.value.clone()), Some("6144".to_string()));

        let small = recommend(4096, 40);
        let mut f = analyze("java.lang.OutOfMemoryError: Java heap space");
        resolve_fixes(&mut f, small.max_mb, &small, None);
        assert_eq!(f[0].id, "out_of_memory_maxed");
        assert!(f[0].fix.is_none());

        let mut f = analyze("Mixin apply for mod swiftclient failed x");
        resolve_fixes(&mut f, 4096, &advice, None);
        assert!(f[0].fix.is_none(), "no older mod to roll back to");
        let mut f = analyze("Mixin apply for mod swiftclient failed x");
        resolve_fixes(&mut f, 4096, &advice, Some("2.2.0".into()));
        assert_eq!(f[0].fix.as_ref().and_then(|x| x.value.clone()), Some("2.2.0".to_string()));
    }
}
