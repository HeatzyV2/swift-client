// HTTP layer for /api/v1: response envelope, route definition (auth + permission + validation + rate limit
// in one place) and the route registry that feeds OpenAPI and docs/API.md.
import type { Context, Hono } from 'hono'
import { z } from 'zod'
import { actorFromToken, type Actor } from './auth.js'
import { AppError, badRequest, forbidden, unauthorized } from './errors.js'
import { checkLimit, clientIp, type LimitName } from './ratelimit.js'
import type { Permission } from './rbac.js'
import { sha256 } from './util.js'

export type PEnv = { Variables: { requestId: string, actor: Actor | null, ip: string } }
export type PContext = Context<PEnv>

/** What a handler may return to control the response. Plain values become `data` with status 200. */
export class Reply {
  constructor(
    public readonly data: unknown,
    public readonly status = 200,
    public readonly meta?: Record<string, unknown>,
    public readonly cacheSec?: number,
  ) {}
}
export const ok = (data: unknown, meta?: Record<string, unknown>) => new Reply(data, 200, meta)
export const created = (data: unknown) => new Reply(data, 201)
/** Public GET with Cache-Control + ETag (304 when unchanged). */
export const cached = (data: unknown, cacheSec: number, meta?: Record<string, unknown>) => new Reply(data, 200, meta, cacheSec)

export type Page<T> = { items: T[], total: number, page: number, limit: number }
export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().max(100).optional(),
})
export function paged<T>(items: T[], total: number, page: number, limit: number): Reply {
  return new Reply(items, 200, { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) })
}

export function envelope(data: unknown, requestId: string, meta?: Record<string, unknown>) {
  return { success: true, data, meta: { requestId, ...meta } }
}

export function errorBody(code: string, message: string, requestId: string, details?: unknown) {
  return { success: false, error: { code, message, ...(details === undefined ? {} : { details }) }, meta: { requestId } }
}

export function zodDetails(err: z.ZodError) {
  return err.issues.slice(0, 20).map(i => ({ path: i.path.join('.'), message: i.message }))
}

// --- Route registry ----------------------------------------------------------------------------------

export type RouteSpec<B extends z.ZodType | undefined, Q extends z.ZodType | undefined> = {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete'
  path: string
  summary: string
  tag: string
  /** public: no token. user: any signed-in platform user. Otherwise the permission required. */
  auth: 'public' | 'user' | Permission
  body?: B
  query?: Q
  rate?: LimitName
}

export type RegisteredRoute = {
  method: string, path: string, summary: string, tag: string, auth: string,
  body?: z.ZodType, query?: z.ZodType,
}
export const registry: RegisteredRoute[] = []
export const API_PREFIX = '/api/v1'

type Infer<S> = S extends z.ZodType ? z.output<S> : undefined
export type Input<B, Q> = { body: Infer<B>, query: Infer<Q>, params: Record<string, string>, actor: Actor | null }

const JSON_LIMIT = 1_000_000

export async function readJson(c: Context, limit = JSON_LIMIT): Promise<unknown> {
  const declared = Number(c.req.header('content-length') ?? 0)
  if (declared > limit) throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body too large')
  const text = await c.req.text()
  if (text.length > limit) throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body too large')
  if (!text.trim()) return {}
  try {
    return JSON.parse(text)
  } catch {
    throw badRequest('Invalid JSON body')
  }
}

export function bearer(c: Context): string {
  const h = c.req.header('authorization') ?? ''
  return h.toLowerCase().startsWith('bearer ') ? h.slice(7).trim() : ''
}

export function defineRoute<B extends z.ZodType | undefined = undefined, Q extends z.ZodType | undefined = undefined>(
  app: Hono<PEnv>,
  spec: RouteSpec<B, Q>,
  handler: (c: PContext, input: Input<B, Q>) => unknown | Promise<unknown>,
) {
  registry.push({ method: spec.method, path: API_PREFIX + spec.path, summary: spec.summary, tag: spec.tag, auth: spec.auth, body: spec.body, query: spec.query })
  app[spec.method](spec.path, async (c) => {
    const ip = clientIp(c)
    c.set('ip', ip)
    checkLimit(spec.rate ?? 'default', ip)

    let actor: Actor | null = null
    if (spec.auth !== 'public') {
      const token = bearer(c)
      if (!token) throw unauthorized()
      actor = await actorFromToken(token)
      if (spec.auth !== 'user' && !actor.permissions.has(spec.auth)) throw forbidden()
    }
    c.set('actor', actor)

    let body: unknown
    if (spec.body) {
      const r = spec.body.safeParse(await readJson(c))
      if (!r.success) throw new AppError(422, 'VALIDATION_ERROR', 'Invalid request body', zodDetails(r.error))
      body = r.data
    }
    let query: unknown
    if (spec.query) {
      const raw = Object.fromEntries(new URL(c.req.url).searchParams)
      const r = spec.query.safeParse(raw)
      if (!r.success) throw new AppError(422, 'VALIDATION_ERROR', 'Invalid query parameters', zodDetails(r.error))
      query = r.data
    }

    const out = await handler(c, { body: body as Infer<B>, query: query as Infer<Q>, params: c.req.param() as Record<string, string>, actor })
    if (out instanceof Response) return out
    const reply = out instanceof Reply ? out : new Reply(out ?? null)
    if (reply.status === 204) return c.body(null, 204)
    const payload = JSON.stringify(envelope(reply.data, c.get('requestId'), reply.meta))
    const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=UTF-8' }
    if (reply.cacheSec !== undefined) {
      // The ETag covers the data only (requestId changes on every request).
      const etag = `"${sha256(JSON.stringify(reply.data ?? null)).slice(0, 24)}"`
      headers['ETag'] = etag
      headers['Cache-Control'] = reply.cacheSec > 0 ? `public, max-age=${reply.cacheSec}` : 'no-cache'
      if (c.req.header('if-none-match') === etag) return new Response(null, { status: 304, headers })
    } else {
      headers['Cache-Control'] = 'no-store'
    }
    return new Response(payload, { status: reply.status, headers })
  })
}

export function actorOf(c: PContext): Actor {
  const a = c.get('actor')
  if (!a) throw unauthorized()
  return a
}
