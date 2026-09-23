# Swift Client online service

HTTP API for the launcher: auth, CurseForge proxy, instance share codes, and Social (friends + chat).

Production host: **`https://api.swiftclient.fr`**

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

## API surface

- `POST /api/auth/register` / `POST /api/auth/login` → `{ token, user }`
- `GET /api/me` / `POST /api/me/link-minecraft`
- `GET|POST /api/curseforge/*` — proxy (501 without key)
- `POST /api/share/upload-url` → PUT zip → `POST /api/share/:code/complete`
- Social under `/api/social/*`

## Reverse proxy

Point Caddy/nginx at the allocation IP:port for `api.swiftclient.fr`.

## Smoke checklist

1. `curl -s https://api.swiftclient.fr/health` → `ok: true`
2. Register + login → Bearer token
3. Chat images purged after 7 days
