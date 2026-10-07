// Test harness: every test file runs in its own process with a throw-away DATA_DIR, then drives the real Hono
// app in memory with app.request(). Import this module FIRST (it sets the environment before env.ts loads).
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'swift-test-'))
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret'
process.env.APP_ENV = 'test'
process.env.PUBLIC_URL = 'https://api.test'
process.env.ADMIN_PUBLIC_URL = 'https://admin.test'
process.env.RATE_LIMIT_DEFAULT = '0'
process.env.RATE_LIMIT_AUTH = '0'
process.env.RATE_LIMIT_INGEST = '0'
process.env.LOGIN_MAX_FAILURES = '3'
process.env.WEBHOOK_ALLOW_PRIVATE = 'true'

const { createApp } = await import('../src/app.js')
const { db } = await import('../src/db.js')
const { setRoles } = await import('../src/platform/modules/iam/service.js')
const { cache } = await import('../src/platform/core/cache.js')

export { db, cache }
export const app = createApp()

export type Json = any
export type Res = { status: number, body: Json, headers: Headers }

export async function call(method: string, path: string, opts: { token?: string, body?: unknown, headers?: Record<string, string>, raw?: BodyInit } = {}): Promise<Res> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) }
  if (opts.token) headers.authorization = `Bearer ${opts.token}`
  let body: BodyInit | undefined = opts.raw
  if (opts.body !== undefined) {
    headers['content-type'] = 'application/json'
    body = JSON.stringify(opts.body)
  }
  const res = await app.request(path, { method, headers, body })
  const text = await res.text()
  let parsed: Json = null
  try { parsed = text ? JSON.parse(text) : null } catch { parsed = text }
  return { status: res.status, body: parsed, headers: res.headers }
}

let counter = 0
/** Creates a Swift account through the legacy API, gives it roles and returns a platform access token. */
export async function staff(roles: string[], password = 'correct-horse-battery'): Promise<{ id: string, username: string, token: string, refresh: string, password: string }> {
  const username = `staff_${roles[0]?.toLowerCase() ?? 'none'}_${++counter}`
  const reg = await call('POST', '/api/auth/register', { body: { username, password } })
  const id = reg.body.user.id as string
  setRoles(id, roles as never, null)
  const login = await call('POST', '/api/v1/auth/login', { body: { username, password } })
  return { id, username, token: login.body.data?.accessToken, refresh: login.body.data?.refreshToken, password }
}
