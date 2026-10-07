// Platform authentication: short-lived access tokens, rotating refresh tokens with reuse detection,
// session revocation and brute-force protection. Legacy launcher/game tokens (30 days, no audience)
// are NOT accepted here: the admin API only trusts tokens issued by /api/v1/auth.
import * as argon2 from 'argon2'
import { SignJWT, jwtVerify } from 'jose'
import { db } from '../../db.js'
import { env } from '../../env.js'
import { AppError, unauthorized } from './errors.js'
import { isRole, permissionsFor, type Role } from './rbac.js'
import { newId, nowIso, randomToken, sha256 } from './util.js'

const AUD = 'swift-platform'
const secret = () => new TextEncoder().encode(env.jwtSecret)

export type Actor = {
  id: string
  username: string
  roles: Role[]
  permissions: Set<string>
  sessionId: string
}

export function userRoles(userId: string): Role[] {
  const rows = db.prepare('SELECT role FROM user_roles WHERE user_id = ?').all(userId) as { role: string }[]
  return rows.map(r => r.role).filter(isRole)
}

export async function signAccessToken(userId: string, sessionId: string): Promise<string> {
  return new SignJWT({ sid: sessionId, typ: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setAudience(AUD)
    .setIssuedAt()
    .setExpirationTime(`${env.accessTokenTtlSec}s`)
    .sign(secret())
}

/** Resolves a bearer access token to an actor, re-reading roles and account state on every request. */
export async function actorFromToken(token: string): Promise<Actor> {
  let payload
  try {
    ;({ payload } = await jwtVerify(token, secret(), { audience: AUD }))
  } catch {
    throw unauthorized('Invalid or expired token')
  }
  if (payload.typ !== 'access' || typeof payload.sub !== 'string' || typeof payload.sid !== 'string') throw unauthorized('Invalid token')
  const user = db.prepare('SELECT id, username, disabled_at FROM users WHERE id = ?').get(payload.sub) as { id: string, username: string, disabled_at: string | null } | undefined
  if (!user || user.disabled_at) throw unauthorized('Account unavailable')
  const live = db.prepare('SELECT 1 FROM refresh_tokens WHERE family_id = ? AND revoked_at IS NULL AND expires_at > ? LIMIT 1').get(payload.sid, nowIso())
  if (!live) throw unauthorized('Session ended')
  const roles = userRoles(user.id)
  return { id: user.id, username: user.username, roles, permissions: permissionsFor(roles), sessionId: payload.sid }
}

// --- Refresh tokens --------------------------------------------------------------------------------

type SessionMeta = { userAgent?: string, ip?: string }

function insertRefresh(userId: string, familyId: string, meta: SessionMeta): { token: string, id: string } {
  const token = randomToken(48)
  const id = newId(16)
  const expires = new Date(Date.now() + env.refreshTokenTtlDays * 86_400_000).toISOString()
  db.prepare('INSERT INTO refresh_tokens (id, user_id, family_id, token_hash, created_at, expires_at, user_agent, ip) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, userId, familyId, sha256(token), nowIso(), expires, meta.userAgent?.slice(0, 200) ?? null, meta.ip ?? null)
  return { token, id }
}

export type Tokens = { accessToken: string, refreshToken: string, expiresIn: number }

export async function issueSession(userId: string, meta: SessionMeta): Promise<Tokens> {
  if (env.insecureSecret) throw new AppError(503, 'AUTH_DISABLED', 'JWT_SECRET is not configured: platform sign-in is disabled')
  const familyId = newId(16)
  const { token } = insertRefresh(userId, familyId, meta)
  return { accessToken: await signAccessToken(userId, familyId), refreshToken: token, expiresIn: env.accessTokenTtlSec }
}

/** Rotates a refresh token. Presenting an already-used token revokes the whole session family. */
export async function rotateSession(refreshToken: string, meta: SessionMeta): Promise<{ tokens: Tokens, userId: string }> {
  const row = db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').get(sha256(refreshToken)) as
    { id: string, user_id: string, family_id: string, expires_at: string, revoked_at: string | null } | undefined
  if (!row) throw unauthorized('Invalid refresh token')
  if (row.revoked_at) {
    db.prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE family_id = ? AND revoked_at IS NULL').run(nowIso(), row.family_id)
    throw unauthorized('Refresh token reuse detected, session revoked')
  }
  if (row.expires_at <= nowIso()) throw unauthorized('Refresh token expired')
  const user = db.prepare('SELECT disabled_at FROM users WHERE id = ?').get(row.user_id) as { disabled_at: string | null } | undefined
  if (!user || user.disabled_at) throw unauthorized('Account unavailable')
  const next = db.transaction(() => {
    const n = insertRefresh(row.user_id, row.family_id, meta)
    db.prepare('UPDATE refresh_tokens SET revoked_at = ?, replaced_by = ? WHERE id = ?').run(nowIso(), n.id, row.id)
    return n
  })()
  return {
    userId: row.user_id,
    tokens: { accessToken: await signAccessToken(row.user_id, row.family_id), refreshToken: next.token, expiresIn: env.accessTokenTtlSec },
  }
}

export function revokeSession(familyId: string): void {
  db.prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE family_id = ? AND revoked_at IS NULL').run(nowIso(), familyId)
}

export function revokeAllSessions(userId: string): void {
  db.prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(nowIso(), userId)
}

export function revokeByRefreshToken(refreshToken: string): void {
  const row = db.prepare('SELECT family_id FROM refresh_tokens WHERE token_hash = ?').get(sha256(refreshToken)) as { family_id: string } | undefined
  if (row) revokeSession(row.family_id)
}

export function purgeExpiredTokens(): void {
  const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString()
  db.prepare('DELETE FROM refresh_tokens WHERE expires_at < ? OR (revoked_at IS NOT NULL AND revoked_at < ?)').run(cutoff, cutoff)
  db.prepare('DELETE FROM auth_throttle WHERE first_fail_at < ? AND (locked_until IS NULL OR locked_until < ?)').run(cutoff, nowIso())
}

// --- Brute force protection --------------------------------------------------------------------------

/** Key = account + address, so one attacker cannot lock an admin out from everywhere. */
const throttleKey = (username: string, ip: string) => `${username.toLowerCase()}|${ip}`

export function assertNotLocked(username: string, ip: string): void {
  const row = db.prepare('SELECT locked_until FROM auth_throttle WHERE key = ?').get(throttleKey(username, ip)) as { locked_until: string | null } | undefined
  if (row?.locked_until && row.locked_until > nowIso()) {
    const sec = Math.ceil((Date.parse(row.locked_until) - Date.now()) / 1000)
    throw new AppError(429, 'ACCOUNT_LOCKED', 'Too many failed attempts, try again later', { retryAfterSec: sec })
  }
}

export function recordFailure(username: string, ip: string): void {
  const key = throttleKey(username, ip)
  const windowMs = env.loginLockMinutes * 60_000
  const row = db.prepare('SELECT fails, first_fail_at FROM auth_throttle WHERE key = ?').get(key) as { fails: number, first_fail_at: string } | undefined
  const fresh = !row || Date.now() - Date.parse(row.first_fail_at) > windowMs
  const fails = fresh ? 1 : row.fails + 1
  const locked = fails >= env.loginMaxFailures ? new Date(Date.now() + windowMs).toISOString() : null
  db.prepare(`INSERT INTO auth_throttle (key, fails, first_fail_at, locked_until) VALUES (?,?,?,?)
    ON CONFLICT(key) DO UPDATE SET fails = excluded.fails, first_fail_at = excluded.first_fail_at, locked_until = excluded.locked_until`)
    .run(key, fails, fresh ? nowIso() : row.first_fail_at, locked)
}

export function clearFailures(username: string, ip: string): void {
  db.prepare('DELETE FROM auth_throttle WHERE key = ?').run(throttleKey(username, ip))
}

let dummyHash: Promise<string> | null = null
/** Burn comparable CPU for unknown accounts so response time does not reveal which usernames exist. */
export async function fakeVerify(password: string): Promise<void> {
  dummyHash ??= argon2.hash('swift-dummy-password', { type: argon2.argon2id })
  await argon2.verify(await dummyHash, password).catch(() => false)
}
