import { createAdaptorServer } from '@hono/node-server'
import net from 'node:net'
import { sniffTls, tlsFiles } from './tls.js'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { env } from './env.js'
import './db.js'
import {
  findUserById,
  publicUser,
  requireAuth,
  type AuthVariables,
} from './auth.js'
import { authRoutes, linkMinecraftHandler } from './routes/auth.js'
import { gameRoutes } from './routes/game.js'
import { startRelay } from './relay.js'
import { curseforgeRoutes } from './routes/curseforge.js'
import { shareRoutes } from './routes/share.js'
import { socialRoutes } from './routes/social.js'
import { contentRoutes } from './routes/content.js'
import { startCleanupJob } from './cleanup.js'

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

app.post('/api/me/link-minecraft', requireAuth, linkMinecraftHandler)

app.route('/api/curseforge', curseforgeRoutes)
app.route('/api/share', shareRoutes)
app.route('/api/social', socialRoutes)
app.route('/api/news', contentRoutes)
app.route('/api', gameRoutes)

app.onError((err, c) => {
  console.error(err)
  return c.json({ message: err.message || 'internal error' }, 500)
})

startCleanupJob()
startRelay()

// HTTPS and plain HTTP on the same port (plain HTTP is kept for older clients).
const httpServer = createAdaptorServer({ fetch: app.fetch })
const listener = net.createServer(sniffTls(
  (sock) => httpServer.emit('connection', sock),
  (sock) => httpServer.emit('connection', sock),
))
listener.listen(env.port, env.host, () => {
  console.log(`Swift Client API listening on ${env.host}:${env.port} (${env.publicUrl})${tlsFiles() ? ', HTTPS + HTTP' : ', HTTP only (no TLS certificate)'}`)
})
