import { config as loadEnv } from 'dotenv'
import { mkdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Pterodactyl / local .env in the working directory
loadEnv()

function firstNum(...names: string[]): number | undefined {
  for (const name of names) {
    const raw = process.env[name]
    if (!raw || !raw.trim()) continue
    const n = Number(raw)
    if (Number.isFinite(n) && n > 0) return n
  }
  return undefined
}

function str(name: string, fallback = ''): string {
  return (process.env[name] ?? fallback).trim()
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase()
  if (!raw) return fallback
  return ['1', 'true', 'yes', 'on'].includes(raw)
}

function list(name: string, fallback = ''): string[] {
  return str(name, fallback).split(',').map(s => s.trim()).filter(Boolean)
}

/** Like firstNum but accepts 0 (used for "disabled" switches). */
function nonNeg(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw || !raw.trim()) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

// Pterodactyl injects SERVER_PORT; fall back to PORT then 8787
const port = firstNum('SERVER_PORT', 'PORT') ?? 8787
const host = str('HOST', '0.0.0.0')
const DEFAULT_SECRET = 'dev-insecure-secret-change-me'
const appEnv = (['production', 'staging', 'test'].includes(str('APP_ENV', str('NODE_ENV'))) ? str('APP_ENV', str('NODE_ENV')) : 'development') as 'production' | 'staging' | 'test' | 'development'

const dataDir = resolve(str('DATA_DIR', './data'))
mkdirSync(dataDir, { recursive: true })
mkdirSync(resolve(dataDir, 'shares'), { recursive: true })
mkdirSync(resolve(dataDir, 'media'), { recursive: true })
mkdirSync(resolve(dataDir, 'uploads'), { recursive: true })
mkdirSync(resolve(dataDir, 'cosmetics'), { recursive: true })
mkdirSync(resolve(dataDir, 'assets'), { recursive: true })

export const env = {
  port,
  host,
  publicUrl: str('PUBLIC_URL', 'https://api.swiftclient.fr').replace(/\/$/, ''),
  sharePublicUrl: str('SHARE_PUBLIC_URL', 'swift://share').replace(/\/$/, ''),
  dataDir,
  jwtSecret: str('JWT_SECRET', DEFAULT_SECRET),
  curseforgeApiKey: str('CURSEFORGE_API_KEY'),
  mediaTtlDays: firstNum('MEDIA_TTL_DAYS') ?? 7,
  shareTtlDays: firstNum('SHARE_TTL_DAYS') ?? 30,
  cleanupIntervalMs: firstNum('CLEANUP_INTERVAL_MS') ?? 3_600_000,
  version: '1.0.0',
  /** Mojang session server, overridable for tests. */
  mojangSessionUrl: str('MOJANG_SESSION_URL', 'https://sessionserver.mojang.com').replace(/\/$/, ''),
  /**
   * World hosting relay (Swift Client "Host World"). RELAY_PORT is the control port the game connects
   * to; each hosted world gets one public port from RELAY_PORT_MIN..RELAY_PORT_MAX. All of them must
   * be open (Pterodactyl: extra allocations). RELAY_PORT=0 disables the relay.
   */
  relayPort: firstNum('RELAY_PORT') ?? 0,
  relayPortMin: firstNum('RELAY_PORT_MIN') ?? 0,
  relayPortMax: firstNum('RELAY_PORT_MAX') ?? 0,
  /**
   * Gateway: players join "<minecraft name>.<RELAY_DOMAIN>" and are routed by the address in their
   * handshake. Needs a wildcard DNS record *.RELAY_DOMAIN -> this server (see README). 0 disables it.
   */
  relayGatewayPort: firstNum('RELAY_GATEWAY_PORT') ?? 0,
  /** HTTPS certificate (PEM). Default: DATA_DIR/tls/api.crt + api.key when they exist. */
  tlsCert: str('TLS_CERT', existsSync(resolve(dataDir, 'tls', 'api.crt')) ? resolve(dataDir, 'tls', 'api.crt') : ''),
  tlsKey: str('TLS_KEY', existsSync(resolve(dataDir, 'tls', 'api.key')) ? resolve(dataDir, 'tls', 'api.key') : ''),
  relayDomain: str('RELAY_DOMAIN', 'swiftclient.fr').toLowerCase().replace(/^\.|\.$/g, ''),
  /**
   * Host the game opens the relay control connection to. Must reach this server directly (not through
   * an HTTP proxy such as Cloudflare). Empty: the game uses relay.<RELAY_DOMAIN>.
   */
  relayHost: str('RELAY_HOST', '').trim(),
  /** Partner servers shown in the game's server list (JSON file, see README). */
  partnersFile: resolve(dataDir, 'partners.json'),

  // --- Swift Platform (/api/v1, admin panel) ---------------------------------------------------
  appEnv,
  /** True when JWT_SECRET is missing: the platform refuses to issue admin tokens in that case. */
  insecureSecret: !process.env.JWT_SECRET?.trim() || str('JWT_SECRET') === DEFAULT_SECRET,
  adminPublicUrl: str('ADMIN_PUBLIC_URL', 'https://admin.swiftclient.fr').replace(/\/$/, ''),
  cdnBaseUrl: str('CDN_BASE_URL', '').replace(/\/$/, ''),
  downloadBaseUrl: str('DOWNLOAD_BASE_URL', 'https://download.swiftclient.fr').replace(/\/$/, ''),
  adminPanelEnabled: bool('ADMIN_PANEL_ENABLED', true),
  /** Extra browser origins allowed to call the admin API (the panel itself is always allowed). */
  corsAdminOrigins: list('CORS_ADMIN_ORIGINS'),
  /** auto: trust X-Forwarded-For only when the direct peer is loopback/private (reverse proxy). */
  trustProxy: (['true', 'false'].includes(str('TRUST_PROXY').toLowerCase()) ? str('TRUST_PROXY').toLowerCase() : 'auto') as 'true' | 'false' | 'auto',
  logLevel: (['debug', 'info', 'warn', 'error', 'silent'].includes(str('LOG_LEVEL')) ? str('LOG_LEVEL') : (appEnv === 'test' ? 'silent' : 'info')) as 'debug' | 'info' | 'warn' | 'error' | 'silent',
  accessTokenTtlSec: firstNum('ACCESS_TOKEN_TTL_SEC') ?? 900,
  refreshTokenTtlDays: firstNum('REFRESH_TOKEN_TTL_DAYS') ?? 30,
  loginMaxFailures: firstNum('LOGIN_MAX_FAILURES') ?? 5,
  loginLockMinutes: firstNum('LOGIN_LOCK_MINUTES') ?? 15,
  /** Requests per minute and per IP. 0 disables the limiter. */
  rateLimitDefault: nonNeg('RATE_LIMIT_DEFAULT', 300),
  rateLimitAuth: nonNeg('RATE_LIMIT_AUTH', 20),
  rateLimitIngest: nonNeg('RATE_LIMIT_INGEST', 120),
  rateLimitUpload: nonNeg('RATE_LIMIT_UPLOAD', 30),
  assetMaxBytes: firstNum('ASSET_MAX_BYTES') ?? 8 * 1024 * 1024,
  analyticsRetentionDays: firstNum('ANALYTICS_RETENTION_DAYS') ?? 90,
  crashRetentionDays: firstNum('CRASH_RETENTION_DAYS') ?? 90,
  auditRetentionDays: firstNum('AUDIT_RETENTION_DAYS') ?? 365,
  /** Salt for pseudonymous device ids. Defaults to a key derived from JWT_SECRET. */
  analyticsSalt: str('ANALYTICS_SALT'),
  webhookAllowPrivate: bool('WEBHOOK_ALLOW_PRIVATE', false),
  webhookTimeoutMs: firstNum('WEBHOOK_TIMEOUT_MS') ?? 8000,
  /** Public cache lifetime (seconds) advertised on launcher endpoints. */
  publicCacheSec: nonNeg('PUBLIC_CACHE_SEC', 60),
}

export function shareRedeemUrl(code: string): string {
  const base = env.sharePublicUrl
  if (base.includes('://') && !base.endsWith('/share') && base.startsWith('swift://')) {
    return `${base}/${code}`
  }
  return `${base}/${code}`
}
