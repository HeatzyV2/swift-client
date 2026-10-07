import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { ZodError } from 'zod'
import { env } from './env.js'
import './db.js'
import { findUserById, publicUser, requireAuth, type AuthVariables } from './auth.js'
import { authRoutes, linkMinecraftHandler } from './routes/auth.js'
import { gameRoutes } from './routes/game.js'
import { curseforgeRoutes } from './routes/curseforge.js'
import { shareRoutes } from './routes/share.js'
import { socialRoutes } from './routes/social.js'
import { contentRoutes } from './routes/content.js'
import { registerAdminStatic } from './platform/admin-static.js'
import { AppError } from './platform/core/errors.js'
import { errorBody, zodDetails, type PEnv } from './platform/core/http.js'
import { errFields, log } from './platform/core/logger.js'
import { legacyLimiter } from './platform/core/ratelimit.js'
import { createV1, initPlatform } from './platform/index.js'
import { platformCors, requestContext, securityHeaders } from './platform/middleware.js'
import { registerAssetFiles } from './platform/modules/assets/routes.js'
import { readiness, versionInfo } from './platform/modules/system/system.js'

type RootEnv = { Variables: AuthVariables & PEnv['Variables'] }

/**
 * The whole HTTP application. Pure: no listening socket, no timers, so tests can drive it with app.request().
 * Legacy launcher/game endpoints under /api/* keep their exact contract; the platform lives under /api/v1.
 */
export function createApp() {
  initPlatform()
  const app = new Hono<RootEnv>()

  app.use('*', requestContext)
  app.use('*', securityHeaders)
  registerAdminStatic(app)

  // Legacy clients (launcher, game mod) call from anywhere and use a { message } error shape.
  const legacyCors = cors({ origin: '*', allowHeaders: ['Authorization', 'Content-Type'], allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] })
  app.use('*', (c, next) => (new URL(c.req.url).pathname.startsWith('/api/v1') ? platformCors(c, next) : legacyCors(c, next)))

  // Brute-force protection on the legacy sign-in endpoints.
  for (const p of ['/api/auth/login', '/api/auth/register', '/api/auth/minecraft']) app.use(p, legacyLimiter('auth'))

  app.get('/health', (c) => c.json({ ok: true, version: env.version, curseforge: Boolean(env.curseforgeApiKey) }))
  app.get('/ready', (c) => {
    const r = readiness()
    return c.json(r, r.ready ? 200 : 503)
  })
  app.get('/version', (c) => c.json(versionInfo()))

  app.route('/api/auth', authRoutes)

  // Aliases used by the launcher contract
  app.get('/api/me', requireAuth, (c) => {
    const session = c.get('user')
    const row = findUserById(session.id)
    if (!row) return c.json({ message: 'user not found' }, 401)
    return c.json({ user: publicUser(row) })
  })
  app.post('/api/me/link-minecraft', requireAuth, linkMinecraftHandler)

  app.route('/api/v1', createV1())
  registerAssetFiles(app as unknown as Hono<PEnv>)

  app.route('/api/curseforge', curseforgeRoutes)
  app.route('/api/share', shareRoutes)
  app.route('/api/social', socialRoutes)
  app.route('/api/news', contentRoutes)
  app.route('/api', gameRoutes)

  app.notFound((c) => {
    if (new URL(c.req.url).pathname.startsWith('/api/v1')) return c.json(errorBody('NOT_FOUND', 'Route not found', c.get('requestId')), 404)
    return c.text('404 Not Found', 404)
  })

  app.onError((err, c) => {
    const requestId = c.get('requestId')
    const v1 = new URL(c.req.url).pathname.startsWith('/api/v1')
    if (err instanceof AppError) {
      if (err.code === 'RATE_LIMITED' || err.code === 'ACCOUNT_LOCKED') c.header('Retry-After', String((err.details as { retryAfterSec?: number } | undefined)?.retryAfterSec ?? 60))
      if (v1) return c.json(errorBody(err.code, err.message, requestId, err.details), err.status as 400)
      return c.json({ message: err.message }, err.status as 400)
    }
    if (err instanceof ZodError) {
      if (v1) return c.json(errorBody('VALIDATION_ERROR', 'Invalid request', requestId, zodDetails(err)), 422)
      return c.json({ message: 'invalid request' }, 400)
    }
    log.error('unhandled error', { requestId, path: new URL(c.req.url).pathname, ...errFields(err) })
    // Never leak internals on the platform API; the legacy contract kept the message for old clients.
    if (v1) return c.json(errorBody('INTERNAL_ERROR', 'Something went wrong', requestId), 500)
    return c.json({ message: err.message || 'internal error' }, 500)
  })

  return app
}
