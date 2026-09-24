import { nanoid } from 'nanoid'
import { createUserId, findUserById } from './auth.js'
import { db, type UserRow } from './db.js'
import { env } from './env.js'

/** Undashed lower-case form, the one used for every comparison. */
export function normUuid(uuid: string): string {
  return uuid.replace(/-/g, '').toLowerCase()
}

export function dashedUuid(uuid: string): string {
  const u = normUuid(uuid)
  return u.length === 32 ? `${u.slice(0, 8)}-${u.slice(8, 12)}-${u.slice(12, 16)}-${u.slice(16, 20)}-${u.slice(20)}` : uuid
}

/** Accounts created by the game (no password) start with this marker in password_hash. */
const SHADOW_PREFIX = '!game:'

export function isShadow(row: UserRow): boolean {
  return row.password_hash.startsWith(SHADOW_PREFIX)
}

/**
 * Proof that the player owns the Minecraft account: the client called Mojang "join" with a random
 * serverId, Mojang confirms it here. Returns the profile, or null if Mojang says no.
 */
export async function hasJoined(username: string, serverId: string): Promise<{ id: string, name: string } | null> {
  const url = `${env.mojangSessionUrl}/session/minecraft/hasJoined?username=${encodeURIComponent(username)}&serverId=${encodeURIComponent(serverId)}`
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (res.status !== 200) return null
  const body = await res.json().catch(() => null) as { id?: string, name?: string } | null
  return body?.id && body.name ? { id: body.id, name: body.name } : null
}

/**
 * Swift account for a Minecraft UUID. Only accounts Mojang vouched for count (anyone can type a UUID
 * into a link request): a real (launcher) account first, else the game-created one.
 */
export function findUserByMinecraft(uuid: string): UserRow | undefined {
  return db.prepare(`
    SELECT * FROM users WHERE lower(replace(mc_uuid, '-', '')) = ? AND mc_verified = 1
    ORDER BY (password_hash LIKE '${SHADOW_PREFIX}%') ASC, created_at ASC LIMIT 1
  `).get(normUuid(uuid)) as UserRow | undefined
}

function freeUsername(base: string): string {
  const clean = base.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 28) || 'player'
  let candidate = clean.length >= 3 ? clean : `${clean}___`.slice(0, 3)
  for (let i = 2; db.prepare('SELECT 1 FROM users WHERE username = ? COLLATE NOCASE').get(candidate); i++) {
    candidate = `${clean.slice(0, 28)}_${i}`
  }
  return candidate
}

/**
 * Account for a player who proved their Minecraft identity. Creates a password-less account the first
 * time, so the game works before the player ever opens the launcher's sign-in.
 */
export function findOrCreateMinecraftUser(uuid: string, name: string): UserRow {
  const existing = findUserByMinecraft(uuid)
  if (existing) {
    if (existing.mc_username !== name) {
      db.prepare('UPDATE users SET mc_username = ? WHERE id = ?').run(name, existing.id)
    }
    return findUserById(existing.id)!
  }

  const id = createUserId()
  db.prepare(`
    INSERT INTO users (id, username, password_hash, mc_uuid, mc_username, mc_verified, created_at)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `).run(id, freeUsername(name), SHADOW_PREFIX + nanoid(24), dashedUuid(uuid), name, new Date().toISOString())
  return findUserById(id)!
}

/**
 * Called when a launcher account links a Minecraft UUID: a game-created account for that UUID is merged
 * into it (cosmetics, coins, equipped items, friends) and deleted, so the player keeps everything.
 */
export function absorbShadowAccounts(userId: string, uuid: string) {
  const shadows = db.prepare(`
    SELECT * FROM users WHERE lower(replace(mc_uuid, '-', '')) = ? AND id <> ? AND password_hash LIKE '${SHADOW_PREFIX}%'
  `).all(normUuid(uuid), userId) as UserRow[]
  const merge = db.transaction((shadow: UserRow) => {
    db.prepare('INSERT OR IGNORE INTO user_cosmetics (user_id, cosmetic_id, created_at) SELECT ?, cosmetic_id, created_at FROM user_cosmetics WHERE user_id = ?')
      .run(userId, shadow.id)
    db.prepare(`
      UPDATE users SET
        coins = coins + ?,
        grade = COALESCE(grade, ?),
        swift_plus_until = COALESCE(swift_plus_until, ?),
        equipped_cape = COALESCE(equipped_cape, ?),
        equipped_pet = COALESCE(equipped_pet, ?),
        mojang_cape_url = COALESCE(mojang_cape_url, ?)
      WHERE id = ?
    `).run(shadow.coins ?? 0, shadow.grade ?? null, shadow.swift_plus_until ?? null, shadow.equipped_cape ?? null,
      shadow.equipped_pet ?? null, shadow.mojang_cape_url ?? null, userId)
    db.prepare('UPDATE friends SET user_id = ? WHERE user_id = ? AND (peer_id IS NULL OR peer_id <> ?)').run(userId, shadow.id, userId)
    db.prepare('UPDATE friends SET peer_id = ? WHERE peer_id = ? AND user_id <> ?').run(userId, shadow.id, userId)
    db.prepare('DELETE FROM users WHERE id = ?').run(shadow.id)
  })
  for (const s of shadows) merge(s)
  return shadows.length
}

/**
 * Links a Minecraft account to a launcher account. With a Mojang proof (serverId the launcher just
 * joined with), the link is verified: the game-created account for that UUID is merged in, and other
 * accounts claiming the UUID without proof lose it. Without proof the link is only informative.
 */
export async function linkMinecraft(userId: string, uuid: string, name: string, serverId?: string): Promise<boolean> {
  let verified = false
  if (serverId) {
    const profile = await hasJoined(name, serverId)
    verified = !!profile && normUuid(profile.id) === normUuid(uuid)
    if (profile && verified) name = profile.name
  }
  db.prepare('UPDATE users SET mc_uuid = ?, mc_username = ?, mc_verified = ? WHERE id = ?')
    .run(dashedUuid(uuid), name, verified ? 1 : 0, userId)
  if (verified) {
    absorbShadowAccounts(userId, uuid)
    db.prepare(`
      UPDATE users SET mc_uuid = NULL, mc_username = NULL
      WHERE lower(replace(mc_uuid, '-', '')) = ? AND id <> ? AND mc_verified = 0
    `).run(normUuid(uuid), userId)
  }
  return verified
}

/** Verified Swift account currently playing as this Minecraft name. */
export function findUserByMinecraftName(name: string): UserRow | undefined {
  return db.prepare(`
    SELECT * FROM users WHERE mc_username = ? COLLATE NOCASE AND mc_verified = 1
    ORDER BY (password_hash LIKE '${SHADOW_PREFIX}%') ASC, last_seen DESC LIMIT 1
  `).get(name) as UserRow | undefined
}
