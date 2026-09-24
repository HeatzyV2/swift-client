# Swift Client online service

HTTP API for the launcher and the in-game Swift Client mod: auth, CurseForge proxy, instance share codes,
Social (friends + chat), cosmetics / shop / grades, partner servers, and the world hosting relay.

Production host: **`http://151.240.30.3:10049`** (the address built into the mod and the launcher).

## Pterodactyl / panel Node egg

The egg startup runs `npm install`, then:

```text
ts-node --esm /home/container/${MAIN_FILE}
```

(unless `MAIN_FILE` is literally `*.js`).

### Panel settings

| Setting | Value |
|---------|--------|
| **MAIN_FILE** | `index.ts` |
| **NODE_ARGS** | leave empty |

On `npm install`, TypeScript compiles `src/` → `dist/`. The root `index.ts` only loads `dist/index.js` (avoids ts-node `.js` import bugs).

Upload the **contents of `backend/`** into `/home/container` so you have:

```text
/home/container/package.json
/home/container/package-lock.json
/home/container/index.ts
/home/container/src/...
/home/container/tsconfig.json
```

**Do not upload `node_modules/`** from Windows (or any other machine). Native addons (`better-sqlite3`, `argon2`) must be installed on the Linux egg. If you already did, wipe and reinstall:

```bash
rm -rf node_modules
npm install
```

After install you should also see `/home/container/dist/`. `postinstall` rebuilds native modules then compiles TypeScript.

Set environment variables in the panel (or a `.env` file):

| Variable | Example |
|----------|---------|
| `PUBLIC_URL` | `https://api.swiftclient.fr` |
| `JWT_SECRET` | long random string |
| `CURSEFORGE_API_KEY` | optional |
| `DATA_DIR` | `/home/container/data` |
| `HOST` | `0.0.0.0` (default) |

`SERVER_PORT` is injected by Pterodactyl and used automatically.

`ts-node` and `typescript` are in `dependencies` so `npm install` on the egg is enough.

## Local quick start

```bash
cd backend
cp .env.example .env
npm install
npm run start:ts-node   # same as the panel
# or: npm run dev
```

Health check: `GET http://127.0.0.1:${SERVER_PORT:-8787}/health`

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `SERVER_PORT` / `PORT` | `8787` | Listen port (Pterodactyl prefers `SERVER_PORT`) |
| `HOST` | `0.0.0.0` | Bind address |
| `PUBLIC_URL` | `https://api.swiftclient.fr` | Absolute URLs for upload/download |
| `SHARE_PUBLIC_URL` | `swift://share` | Redeem link prefix |
| `DATA_DIR` | `./data` | SQLite + share zips + chat media |
| `JWT_SECRET` | (required in prod) | Signs session tokens |
| `CURSEFORGE_API_KEY` | empty | Without it, `/api/curseforge` returns **501** |
| `MEDIA_TTL_DAYS` | `7` | Chat images auto-delete after this many days |
| `SHARE_TTL_DAYS` | `30` | Share pack expiry |
| `CLEANUP_INTERVAL_MS` | `3600000` | Purge job interval (1h) |
| `RELAY_PORT` | empty (off) | World hosting relay: control port the game connects to |
| `RELAY_PORT_MIN` / `RELAY_PORT_MAX` | empty | Public ports handed to hosted worlds (one per world) |
| `MOJANG_SESSION_URL` | `https://sessionserver.mojang.com` | Only changed for tests |

### World hosting relay on Pterodactyl

Each port must be an **allocation** of the server (Network tab), since the panel only forwards those:

1. Add one allocation for the control port, e.g. `10050` → `RELAY_PORT=10050`.
2. Add a contiguous range for hosted worlds, e.g. `10051`–`10060` → `RELAY_PORT_MIN=10051`, `RELAY_PORT_MAX=10060`
   (10 worlds hosted at the same time).
3. Restart. The log shows `[relay] control on ...`. The mod finds the port through `GET /api/relay`.

### Partner servers

`DATA_DIR/partners.json` (optional, read on every request):

```json
{ "servers": [ { "name": "Elysia SMP", "ip": "elysiasmp.com", "port": 25565 } ] }
```

Without the file, the partner list is Elysia SMP.

### Admin (cosmetics, coins, grades, Swift+)

From the Pterodactyl console (after `npm install`):

```bash
node dist/admin.js cosmetic add flame cape 500 /home/container/assets/flame.png Flame Cape --frames 8 --fps 12 --size 64x32
node dist/admin.js cosmetic add fox pet 800 fox.png Fox --model fox.geo.json --animation fox.animation.json --loop animation.fox.idle
node dist/admin.js cosmetic list
node dist/admin.js coins Notch +1000
node dist/admin.js give Notch flame
node dist/admin.js grade Notch staff        # "none" clears it
node dist/admin.js plus Notch 30            # Swift+ for 30 days, 0 removes it
node dist/admin.js user Notch
```

A player is a Swift username, a Minecraft name or a Minecraft UUID. Players get an account the first time
they launch Swift Client (no sign-up needed in game).

## API surface

- `POST /api/auth/register` / `POST /api/auth/login` → `{ token, user }`
- `POST /api/auth/minecraft` `{ username, uuid, serverId }` → `{ token, expiresAt, user }`: game sign-in, the mod
  calls Mojang `join` with `serverId` and the backend checks it with `hasJoined`
- `GET /api/me` / `POST /api/me/link-minecraft` `{ uuid, username, serverId? }`: with a Mojang proof the link is
  verified and the game account for that UUID (cosmetics, coins, friends) is merged into the launcher account
- Game (Bearer game token): `POST /api/users/heartbeat`, `POST /api/users/grades`, `POST /api/cosmetics/{equipped,animated,pets}`
  (`{ uuids }` → `{ uuid: value }`), `GET /api/cosmetics/owned/:uuid`, `POST /api/cosmetics/{buy,equip,equip-pet,cape-animated,mojang-cape}`,
  `GET /api/cosmetics/{texture,pet-model}/:id`
- Public: `GET /api/cosmetics/catalog`, `GET /api/shop/balance/:uuid`, `GET /api/subscription/status/:uuid`,
  `GET /api/partners/ingame`, `GET /api/servers`, `GET /api/relay`
- `GET|POST /api/curseforge/*` — proxy (501 without key)
- `POST /api/share/upload-url` → PUT zip → `POST /api/share/:code/complete`
- Social under `/api/social/*`

## Reverse proxy

Point Caddy/nginx at the allocation IP:port for `api.swiftclient.fr`.

## Smoke checklist

1. `curl -s http://151.240.30.3:10049/health` → `ok: true, version: 0.2.0`
2. Register + login → Bearer token
3. Chat images purged after 7 days
