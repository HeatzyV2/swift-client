// Fixed-window rate limiter, in memory (single node). Limits are per minute and per client IP.
import type { Context, MiddlewareHandler } from 'hono'
import { env } from '../../env.js'
import { tooMany } from './errors.js'

type Bucket = { count: number, resetAt: number }
const buckets = new Map<string, Bucket>()
let lastSweep = Date.now()

export const LIMITS = {
  default: () => env.rateLimitDefault,
  auth: () => env.rateLimitAuth,
  ingest: () => env.rateLimitIngest,
  upload: () => env.rateLimitUpload,
} as const
export type LimitName = keyof typeof LIMITS

const isPrivate = (ip: string) =>
  /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip) || ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('::ffff:127.') || ip.startsWith('::ffff:10.') || ip.startsWith('::ffff:192.168.')

/** Client address. X-Forwarded-For is honoured only behind a proxy (see TRUST_PROXY). */
export function clientIp(c: Context): string {
  const peer = ((c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)?.incoming?.socket?.remoteAddress) ?? 'unknown'
  const trust = env.trustProxy === 'true' || (env.trustProxy === 'auto' && isPrivate(peer))
  if (trust) {
    const fwd = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    if (fwd && /^[0-9a-fA-F:.]{3,45}$/.test(fwd)) return fwd
  }
  return peer
}

/** Returns normally when allowed, throws RATE_LIMITED otherwise. */
export function checkLimit(name: LimitName, key: string, limit = LIMITS[name]()): void {
  if (limit <= 0) return
  const now = Date.now()
  if (now - lastSweep > 60_000) {
    lastSweep = now
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k)
  }
  const id = `${name}:${key}`
  let b = buckets.get(id)
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + 60_000 }
    buckets.set(id, b)
  }
  b.count++
  if (b.count > limit) throw tooMany(Math.max(1, Math.ceil((b.resetAt - now) / 1000)))
}

export function resetLimits() {
  buckets.clear()
}

/** Express-style middleware for legacy endpoints (login/register): same limiter, legacy error shape. */
export function legacyLimiter(name: LimitName): MiddlewareHandler {
  return async (c, next) => {
    try {
      checkLimit(name, clientIp(c))
    } catch (e) {
      const retry = (e as { details?: { retryAfterSec?: number } }).details?.retryAfterSec ?? 60
      c.header('Retry-After', String(retry))
      return c.json({ message: 'too many requests, slow down' }, 429)
    }
    await next()
  }
}
