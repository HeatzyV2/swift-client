<div align="center">
  <img src="public/brand/app-icon.svg" alt="Swift Client" width="96" />

  # Swift Client

  **Minecraft, launched fast.**

  A modern, lightweight Minecraft launcher: pick an instance, press Play.
</div>

---

## What it does

- **Instances** — separate Minecraft installs, each with its own version, mods and worlds. Group them, duplicate them, back them up.
- **Every loader** — Vanilla, Fabric, Quilt, Forge and NeoForge.
- **Mods from Modrinth** — search and install mods, resource packs, shaders, datapacks and full modpacks, with dependencies and updates handled for you.
- **Accounts** — Microsoft sign-in, or offline accounts for singleplayer.
- **Java handled** — the right Java runtime is downloaded for each Minecraft version.
- **Worlds, screenshots, skins** — all your saves and screenshots across instances in one place, and a 3D skin preview with capes.
- **Quick Play** — jump straight into a world or server (1.20+).
- **Live logs and crash help** — watch the game console, open crash reports, share logs through mclo.gs.
- **Restore points** — snapshot an instance before an update and roll back if something breaks.
- **Import** — bring instances over from Prism, CurseForge or the Modrinth App, or from `.mrpack` / `.zip` files.
- **Discord Rich Presence** (optional).

### Privacy

Swift Client sends **no telemetry, analytics or crash data**. It only contacts the services needed to play: Microsoft/Xbox (sign-in), Mojang (game files), Modrinth (content), your mod loader's servers, and — only when you ask — mclo.gs for log sharing.

### Not available yet / online service

These need the Swift Client online service at **`https://api.swiftclient.fr`** (see [`backend/`](backend/)):

- CurseForge browsing and installs (API key lives on the server)
- Sharing instances by code (requires a Swift Client account in Settings)
- Remote Social friends chat (local Social works offline)
- Automatic updates (not implemented yet)

Build the launcher with `SWIFT_BACKEND_URL=https://api.swiftclient.fr` in `src-tauri/.env` (already set in `.env.example`).

## Development

Requirements: Node 22+, pnpm 10, Rust stable, and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS.

```bash
pnpm install
pnpm tauri dev      # run the app
pnpm tauri build    # build installers
```

```bash
cd src-tauri && cargo test   # backend tests
```

### Build-time configuration

Copy `src-tauri/.env.example` to `src-tauri/.env`:

| Variable | Purpose |
|---|---|
| `DISCORD_CLIENT_ID` | Discord application id for Rich Presence. Empty = no Discord status. |
| `SWIFT_BACKEND_URL` | `https://` base URL of the Swift Client online service (production: `https://api.swiftclient.fr`). Empty = CurseForge and remote sharing stay off. |

### Project layout

```text
app/                  Nuxt 4 (Vue 3) frontend
src-tauri/            Rust backend (Tauri 2)
backend/              Online service (Node.js) — api.swiftclient.fr
i18n/locales/         translations
```

### Replacing the logo

The "S" mark is defined in `app/components/brand/Mark.vue` and `src-tauri/icons/source/*.svg`. After changing the SVG sources, regenerate every icon:

```bash
pnpm tauri icon src-tauri/icons/source/app-icon.svg
cp src-tauri/icons/icon.ico public/favicon.ico
cp src-tauri/icons/source/app-icon.svg public/favicon.svg
```

### Data folder

Everything lives in `%APPDATA%\SwiftClient` on Windows (the OS data directory elsewhere). Set `SWIFT_DATA_DIR` for a portable install.

```text
<data root>/
├── launcher.json      settings
├── accounts.json      accounts (tokens encrypted at rest on Windows)
├── instances/<id>/    instance.json, content.json, minecraft/
├── runtimes/          Java runtimes
├── skins/  cache/  logs/
```

## License

Swift Client is free software under the **GNU General Public License v3.0** — see [LICENCE](LICENCE).

It is based on [Spectra Launcher](https://github.com/MakotoPD/Spectra-Launcher) by MakotoPD, also GPL-3.0. Swift Client is not affiliated with Mojang, Microsoft or the Spectra Launcher project.
