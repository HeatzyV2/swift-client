import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { env } from './env.js'
import './db.js'
import {
  findUserById,
  publicUser,
  requireAuth,
  signToken,
  type AuthVariables,
} from './auth.js'
import { authRoutes } from './routes/auth.js'
import { curseforgeRoutes } from './routes/curseforge.js'
import { shareRoutes } from './routes/share.js'
import { socialRoutes } from './routes/social.js'
import { startCleanupJob } from './cleanup.js'
import { db } from './db.js'

const app = new Hono<{ Variables: AuthVariables }>()

app.use('*', cors({
  origin: '*',
  allowHeaders: ['Authorization', 'Content-Type'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}))

app.get('/health', (c) => c.json({
  ok: true,
  version: env.version,
  curseforge: Boolean(env.curseforgeApiKey),
}))

app.route('/api/auth', authRoutes)

// Aliases used by the launcher contract
app.get('/api/me', requireAuth, (c) => {
  const session = c.get('user')
  const row = findUserById(session.id)
  if (!row) return c.json({ message: 'user not found' }, 401)
  return c.json({ user: publicUser(row) })
})

app.post('/api/me/link-minecraft', requireAuth, async (c) => {
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

app.route('/api/curseforge', curseforgeRoutes)
app.route('/api/share', shareRoutes)
app.route('/api/social', socialRoutes)

app.onError((err, c) => {
  console.error(err)
  return c.json({ message: err.message || 'internal error' }, 500)
})

startCleanupJob()

console.log(`Swift Client API listening on ${env.host}:${env.port} (${env.publicUrl})`)
serve({ fetch: app.fetch, port: env.port, hostname: env.host })
