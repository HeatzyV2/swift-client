import { Hono } from 'hono'
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

authRoutes.post('/me/link-minecraft', requireAuth, async (c) => {
  const session = c.get('user')
  const body = await c.req.json().catch(() => null) as { uuid?: string, username?: string } | null
  const uuid = body?.uuid?.trim() ?? ''
  const mcUsername = body?.username?.trim() ?? ''
  if (!uuid || !mcUsername) {
    return c.json({ message: 'uuid and username required' }, 400)
  }
  db.prepare('UPDATE users SET mc_uuid = ?, mc_username = ? WHERE id = ?').run(uuid, mcUsername, session.id)
  const row = findUserById(session.id)!
  const token = await signToken({
    id: row.id,
    username: row.username,
    mc_uuid: row.mc_uuid,
    mc_username: row.mc_username,
  })
  return c.json({ token, user: publicUser(row) })
})
