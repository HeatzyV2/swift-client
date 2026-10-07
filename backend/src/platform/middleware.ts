// Cross-cutting middleware: request id + access log, security headers, CORS for /api/v1.
import type { Context, MiddlewareHandler } from 'hono'
import { env } from '../env.js'
import { clientIp } from './core/ratelimit.js'
import { log } from './core/logger.js'
import { newId } from './core/util.js'

export const requestContext: MiddlewareHandler = async (c, next) => {
  const incoming = c.req.header('x-request-id')
  const id = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : newId(16)
  c.set('requestId', id)
  const started = Date.now()
  await next()
  c.res.headers.set('X-Request-Id', id)
  const path = new URL(c.req.url).pathname
  if (path === '/health' || path === '/ready' || path.startsWith('/admin/') || path.startsWith('/cdn/')) return
  log.info('request', { requestId: id, method: c.req.method, path, status: c.res.status, ms: Date.now() - started, ip: clientIp(c) })
}

const isHttps = (c: Context) => c.req.header('x-forwarded-proto') === 'https' || new URL(c.req.url).protocol === 'https:'

export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next()
  const h = c.res.headers
  h.set('X-Content-Type-Options', 'nosniff')
  h.set('Referrer-Policy', 'no-referrer')
  h.set('X-Frame-Options', 'DENY')
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
  h.set('Cross-Origin-Opener-Policy', 'same-origin')
  if (isHttps(c)) h.set('Strict-Transport-Security', 'max-age=31536000')
  if (!h.has('Content-Security-Policy')) {
    const html = (h.get('content-type') ?? '').includes('text/html')
    h.set('Content-Security-Policy', html
      ? `default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' ${env.publicUrl}; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`
      : "default-src 'none'; frame-ancestors 'none'")
  }
}

const PUBLIC_PREFIXES = ['/api/v1/launcher/', '/api/v1/analytics/events', '/api/v1/diagnostics/report', '/api/v1/health', '/api/v1/ready', '/api/v1/version', '/api/v1/openapi.json']

function allowedOrigins(): Set<string> {
  const set = new Set<string>([new URL(env.adminPublicUrl).origin, new URL(env.publicUrl).origin, ...env.corsAdminOrigins])
  if (env.appEnv !== 'production') for (const o of ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8787', 'http://127.0.0.1:8787']) set.add(o)
  return set
}

/**
 * Public launcher endpoints answer any origin (the launcher is a desktop webview). Admin endpoints carry a bearer
 * token and only answer the admin panel's origins.
 */
export const platformCors: MiddlewareHandler = async (c, next) => {
  const origin = c.req.header('origin')
  const path = new URL(c.req.url).pathname
  const isPublic = PUBLIC_PREFIXES.some(p => path.startsWith(p))
  let allow: string | null = null
  if (origin && allowedOrigins().has(origin)) allow = origin
  else if (isPublic) allow = '*'
  const set = (res: Response) => {
    if (!allow) return
    res.headers.set('Access-Control-Allow-Origin', allow)
    if (allow !== '*') res.headers.append('Vary', 'Origin')
    res.headers.set('Access-Control-Expose-Headers', 'X-Request-Id, ETag, Retry-After')
  }
  if (c.req.method === 'OPTIONS') {
    const res = new Response(null, { status: 204 })
    set(res)
    if (allow) {
      res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
      res.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, If-None-Match, X-Request-Id')
      res.headers.set('Access-Control-Max-Age', '600')
    }
    return res
  }
  await next()
  set(c.res)
}
