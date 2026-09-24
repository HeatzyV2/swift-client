import { Hono, type Context } from 'hono'
import {
  createUserId,
  findUserById,
  findUserByUsername,
  hashPassword,
  publicUser,
  requireAuth,
  signToken,
  verifyPassword,
  type AuthVariables,
} from '../auth.js'
import { db } from '../db.js'
import { findOrCreateMinecraftUser, hasJoined, linkMinecraft, normUuid } from '../minecraft.js'

export const authRoutes = new Hono<{ Variables: AuthVariables }>()

authRoutes.post('/register', async (c) => {
  const body = await c.req.json().catch(() => null) as { username?: string, password?: string } | null
  const username = body?.username?.trim() ?? ''
  const password = body?.password ?? ''
  if (username.length < 3 || username.length > 32) {
    return c.json({ message: 'username must be 3–32 characters' }, 400)
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return c.json({ message: 'username may only contain letters, numbers and _' }, 400)
  }
  if (password.length < 8) {
    return c.json({ message: 'password must be at least 8 characters' }, 400)
  }
  if (findUserByUsername(username)) {
    return c.json({ message: 'username already taken' }, 409)
  }
  const id = createUserId()
  const password_hash = await hashPassword(password)
  const created_at = new Date().toISOString()
  db.prepare(
    'INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)',
  ).run(id, username, password_hash, created_at)
  const user = findUserById(id)!
  const token = await signToken({
    id: user.id,
    username: user.username,
    mc_uuid: user.mc_uuid,
    mc_username: user.mc_username,
  })
  return c.json({ token, user: publicUser(user) })
})

authRoutes.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null) as { username?: string, password?: string } | null
  const username = body?.username?.trim() ?? ''
  const password = body?.password ?? ''
  const row = findUserByUsername(username)
  if (!row || !(await verifyPassword(row.password_hash, password))) {
    return c.json({ message: 'invalid username or password' }, 401)
  }
  const token = await signToken({
    id: row.id,
    username: row.username,
    mc_uuid: row.mc_uuid,
    mc_username: row.mc_username,
  })
  return c.json({ token, user: publicUser(row) })
})

authRoutes.post('/refresh', requireAuth, async (c) => {
  const session = c.get('user')
  const row = findUserById(session.id)
  if (!row) return c.json({ message: 'user not found' }, 401)
  const token = await signToken({
    id: row.id,
    username: row.username,
    mc_uuid: row.mc_uuid,
    mc_username: row.mc_username,
  })
  return c.json({ token, user: publicUser(row) })
})

authRoutes.get('/me', requireAuth, async (c) => {
  const session = c.get('user')
  const row = findUserById(session.id)
  if (!row) return c.json({ message: 'user not found' }, 401)
  return c.json({ user: publicUser(row) })
})

authRoutes.post('/me/link-minecraft', requireAuth, linkMinecraftHandler)

/**
 * Game sign-in. The mod called Mojang "join" with a random serverId; Mojang confirms the player owns the
 * account, and the player gets the Swift account for that UUID (created on first use).
 */
authRoutes.post('/minecraft', async (c) => {
  const body = await c.req.json().catch(() => null) as { username?: string, uuid?: string, serverId?: string } | null
  const username = body?.username?.trim() ?? ''
  const uuid = body?.uuid?.trim() ?? ''
  const serverId = body?.serverId?.trim() ?? ''
  if (!username || !uuid || !serverId || serverId.length > 64) {
    return c.json({ message: 'username, uuid and serverId required' }, 400)
  }
  const profile = await hasJoined(username, serverId).catch(() => null)
  if (!profile || normUuid(profile.id) !== normUuid(uuid)) {
    return c.json({ message: 'Mojang did not confirm this session' }, 401)
  }
  const row = findOrCreateMinecraftUser(profile.id, profile.name)
  const token = await signToken({
    id: row.id,
    username: row.username,
    mc_uuid: row.mc_uuid,
    mc_username: row.mc_username,
  })
  return c.json({ token, expiresAt: Date.now() + 30 * 24 * 3600 * 1000, user: publicUser(row) })
})

export async function linkMinecraftHandler(c: Context<{ Variables: AuthVariables }>) {
  const session = c.get('user')
  const body = await c.req.json().catch(() => null) as { uuid?: string, username?: string, serverId?: string } | null
  const uuid = body?.uuid?.trim() ?? ''
  const mcUsername = body?.username?.trim() ?? ''
  if (!/^[0-9a-fA-F-]{32,36}$/.test(uuid) || !mcUsername) {
    return c.json({ message: 'uuid and username required' }, 400)
  }
  const verified = await linkMinecraft(session.id, uuid, mcUsername, body?.serverId?.trim() || undefined)
  const row = findUserById(session.id)!
  const token = await signToken({
    id: row.id,
    username: row.username,
    mc_uuid: row.mc_uuid,
    mc_username: row.mc_username,
  })
  return c.json({ token, user: publicUser(row), verified })
}
