// Outgoing webhooks: signed (HMAC-SHA256), retried with backoff, delivery log, optional Discord format.
// Private/loopback targets are refused (SSRF) unless WEBHOOK_ALLOW_PRIVATE=true.
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import type { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../../../db.js'
import { env } from '../../../env.js'
import { audit } from '../../core/audit.js'
import { badRequest, notFound } from '../../core/errors.js'
import { EVENT_NAMES, onEvent, type EventName } from '../../core/events.js'
import { created, defineRoute, ok, paged, pageQuery, type PEnv } from '../../core/http.js'
import { log, errFields } from '../../core/logger.js'
import { fromJson, hmac, newId, nowIso, randomToken, toJson } from '../../core/util.js'

const BACKOFF_SEC = [60, 300, 1800, 7200, 43200]
const MAX_ATTEMPTS = BACKOFF_SEC.length + 1

export function isPrivateAddress(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^::ffff:/, '')
  if (isIP(v) === 4) {
    const [a, b] = v.split('.').map(Number)
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  }
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')
}

function checkUrl(raw: string): URL {
  let u: URL
  try { u = new URL(raw) } catch { throw badRequest('Invalid webhook URL') }
  const secure = u.protocol === 'https:'
  if (!secure && !(u.protocol === 'http:' && (env.appEnv !== 'production' || env.webhookAllowPrivate))) throw badRequest('Webhook URL must use https')
  if (u.username || u.password) throw badRequest('Webhook URL must not contain credentials')
  if (!env.webhookAllowPrivate) {
    const h = u.hostname.replace(/^\[|\]$/g, '')
    if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local') || (isIP(h) && isPrivateAddress(h))) throw badRequest('Webhook URL points to a private address')
  }
  return u
}

type HookRow = { id: string, name: string, kind: string, url: string, secret: string, events: string, enabled: number, created_at: string, updated_at: string }

const describeHook = (r: HookRow) => ({
  id: r.id, name: r.name, kind: r.kind, url: r.url, events: fromJson<string[]>(r.events, []), enabled: !!r.enabled,
  secretHint: `…${r.secret.slice(-4)}`, createdAt: r.created_at, updatedAt: r.updated_at,
})

const eventList = z.array(z.enum([...EVENT_NAMES, '*'] as [string, ...string[]])).min(1).max(20)
const hookInput = z.object({
  name: z.string().trim().min(2).max(60),
  kind: z.enum(['generic', 'discord']).default('generic'),
  url: z.string().trim().max(600),
  events: eventList,
  enabled: z.boolean().default(true),
})

function enqueue(hook: HookRow, event: string, data: Record<string, unknown>) {
  const payload = { id: newId(16), event, createdAt: nowIso(), data }
  db.prepare('INSERT INTO webhook_deliveries (id, webhook_id, event, payload, status, next_attempt_at, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(payload.id, hook.id, event, toJson(payload), 'pending', nowIso(), nowIso())
}

/** Subscribes to domain events and queues one delivery per matching, enabled webhook. */
export function startWebhookDispatch() {
  onEvent((event, data) => {
    const hooks = db.prepare('SELECT * FROM webhooks WHERE enabled = 1').all() as HookRow[]
    for (const h of hooks) {
      const ev = fromJson<string[]>(h.events, [])
      if (ev.includes('*') || ev.includes(event)) enqueue(h, event, data)
    }
  })
}

const COLORS: Record<string, number> = { release: 0x3b82f6, news: 0x3ecf8e, maintenance: 0xf2a33a, crash: 0xf2555a }
function discordBody(payload: { event: string, createdAt: string, data: Record<string, unknown> }) {
  const lines = Object.entries(payload.data).slice(0, 8).map(([k, v]) => `**${k}**: ${typeof v === 'object' ? JSON.stringify(v).slice(0, 120) : String(v).slice(0, 120)}`)
  return { username: 'Swift Platform', embeds: [{ title: payload.event, description: lines.join('\n') || undefined, color: COLORS[payload.event.split('.')[0]] ?? 0x5f6b80, timestamp: payload.createdAt }] }
}

type DeliveryRow = { id: string, webhook_id: string, event: string, payload: string, attempts: number }

async function deliver(d: DeliveryRow, hook: HookRow): Promise<void> {
  let status: number | null = null
  let error: string | null = null
  try {
    const url = checkUrl(hook.url)
    if (!env.webhookAllowPrivate) {
      const addrs = await lookup(url.hostname.replace(/^\[|\]$/g, ''), { all: true })
      if (addrs.some(a => isPrivateAddress(a.address))) throw new Error('resolves to a private address')
    }
    const payload = fromJson<{ event: string, createdAt: string, data: Record<string, unknown> }>(d.payload, { event: d.event, createdAt: nowIso(), data: {} })
    const body = hook.kind === 'discord' ? JSON.stringify(discordBody(payload)) : d.payload
    const t = Math.floor(Date.now() / 1000)
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), env.webhookTimeoutMs)
    try {
      const res = await fetch(url, {
        method: 'POST', body, redirect: 'manual', signal: ctl.signal,
        headers: {
          'Content-Type': 'application/json', 'User-Agent': `SwiftPlatform/${env.version}`,
          'X-Swift-Event': d.event, 'X-Swift-Delivery': d.id, 'X-Swift-Signature': `t=${t},v1=${hmac(hook.secret, `${t}.${body}`)}`,
        },
      })
      status = res.status
      if (!res.ok) error = `HTTP ${res.status}`
    } finally {
      clearTimeout(timer)
    }
  } catch (e) {
    error = e instanceof Error ? e.message.slice(0, 200) : 'request failed'
  }
  const attempts = d.attempts + 1
  if (!error) {
    db.prepare("UPDATE webhook_deliveries SET status='success', attempts=?, last_status=?, last_error=NULL, delivered_at=? WHERE id=?").run(attempts, status, nowIso(), d.id)
  } else if (attempts >= MAX_ATTEMPTS) {
    db.prepare("UPDATE webhook_deliveries SET status='failed', attempts=?, last_status=?, last_error=? WHERE id=?").run(attempts, status, error, d.id)
    log.warn('webhook delivery failed permanently', { webhook: hook.id, event: d.event, error })
  } else {
    const next = new Date(Date.now() + BACKOFF_SEC[attempts - 1] * 1000).toISOString()
    db.prepare("UPDATE webhook_deliveries SET status='pending', attempts=?, last_status=?, last_error=?, next_attempt_at=? WHERE id=?").run(attempts, status, error, next, d.id)
  }
}

let running: Promise<number> | null = null
/** Sends every due delivery. Concurrent callers wait for the run in progress, then run once more. */
export async function processDeliveries(): Promise<number> {
  while (running) await running.catch(() => 0)
  running = sendDue()
  try {
    return await running
  } finally {
    running = null
  }
}

async function sendDue(): Promise<number> {
  {
    const due = db.prepare("SELECT * FROM webhook_deliveries WHERE status = 'pending' AND next_attempt_at <= ? ORDER BY created_at LIMIT 20").all(nowIso()) as DeliveryRow[]
    for (const d of due) {
      const hook = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(d.webhook_id) as HookRow | undefined
      if (!hook || !hook.enabled) {
        db.prepare("UPDATE webhook_deliveries SET status='failed', last_error='webhook disabled or deleted' WHERE id=?").run(d.id)
        continue
      }
      await deliver(d, hook).catch(e => log.error('delivery crashed', errFields(e)))
    }
    return due.length
  }
}

export function purgeDeliveries(): void {
  db.prepare('DELETE FROM webhook_deliveries WHERE created_at < ?').run(new Date(Date.now() - 30 * 86_400_000).toISOString())
}

export function registerWebhooks(app: Hono<PEnv>) {
  defineRoute(app, { method: 'get', path: '/webhooks', tag: 'Webhooks', auth: 'webhooks.manage', summary: 'List webhooks' }, () =>
    ok({ events: EVENT_NAMES, items: (db.prepare('SELECT * FROM webhooks ORDER BY created_at DESC').all() as HookRow[]).map(describeHook) }))

  defineRoute(app, { method: 'post', path: '/webhooks', tag: 'Webhooks', auth: 'webhooks.manage', summary: 'Create a webhook (the signing secret is shown once)', body: hookInput }, (c, { body }) => {
    checkUrl(body.url)
    const id = newId(12)
    const secret = randomToken(24)
    const now = nowIso()
    db.prepare('INSERT INTO webhooks (id, name, kind, url, secret, events, enabled, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)').run(id, body.name, body.kind, body.url, secret, toJson(body.events), body.enabled ? 1 : 0, now, now)
    audit(c, 'webhook.created', 'webhook', id, { summary: body.name, after: { ...body, url: new URL(body.url).origin } })
    return created({ ...describeHook(db.prepare('SELECT * FROM webhooks WHERE id = ?').get(id) as HookRow), secret })
  })

  defineRoute(app, { method: 'put', path: '/webhooks/:id', tag: 'Webhooks', auth: 'webhooks.manage', summary: 'Update a webhook', body: hookInput }, (c, { params, body }) => {
    const row = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(params.id) as HookRow | undefined
    if (!row) throw notFound('Webhook')
    checkUrl(body.url)
    db.prepare('UPDATE webhooks SET name=?, kind=?, url=?, events=?, enabled=?, updated_at=? WHERE id=?').run(body.name, body.kind, body.url, toJson(body.events), body.enabled ? 1 : 0, nowIso(), row.id)
    audit(c, 'webhook.updated', 'webhook', row.id, { summary: body.name })
    return ok(describeHook(db.prepare('SELECT * FROM webhooks WHERE id = ?').get(row.id) as HookRow))
  })

  defineRoute(app, { method: 'post', path: '/webhooks/:id/rotate-secret', tag: 'Webhooks', auth: 'webhooks.manage', summary: 'Generate a new signing secret (shown once)' }, (c, { params }) => {
    const row = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(params.id) as HookRow | undefined
    if (!row) throw notFound('Webhook')
    const secret = randomToken(24)
    db.prepare('UPDATE webhooks SET secret = ?, updated_at = ? WHERE id = ?').run(secret, nowIso(), row.id)
    audit(c, 'webhook.secret_rotated', 'webhook', row.id, { summary: row.name })
    return ok({ secret })
  })

  defineRoute(app, { method: 'delete', path: '/webhooks/:id', tag: 'Webhooks', auth: 'webhooks.manage', summary: 'Delete a webhook and its deliveries' }, (c, { params }) => {
    const row = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(params.id) as HookRow | undefined
    if (!row) throw notFound('Webhook')
    db.prepare('DELETE FROM webhooks WHERE id = ?').run(row.id)
    audit(c, 'webhook.deleted', 'webhook', row.id, { summary: row.name })
    return ok({ deleted: true })
  })

  defineRoute(app, { method: 'post', path: '/webhooks/:id/test', tag: 'Webhooks', auth: 'webhooks.manage', summary: 'Queue a test.ping delivery' }, (_c, { params }) => {
    const row = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(params.id) as HookRow | undefined
    if (!row) throw notFound('Webhook')
    enqueue(row, 'test.ping' satisfies EventName, { message: 'Hello from Swift Platform' })
    void processDeliveries()
    return ok({ queued: true })
  })

  defineRoute(app, { method: 'get', path: '/webhooks/:id/deliveries', tag: 'Webhooks', auth: 'webhooks.manage', summary: 'Delivery log', query: pageQuery }, (_c, { params, query }) => {
    const total = (db.prepare('SELECT COUNT(*) AS n FROM webhook_deliveries WHERE webhook_id = ?').get(params.id) as { n: number }).n
    const rows = db.prepare('SELECT id, event, status, attempts, last_status AS lastStatus, last_error AS lastError, next_attempt_at AS nextAttemptAt, created_at AS createdAt, delivered_at AS deliveredAt FROM webhook_deliveries WHERE webhook_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(params.id, query.limit, (query.page - 1) * query.limit)
    return paged(rows, total, query.page, query.limit)
  })

  defineRoute(app, { method: 'post', path: '/webhook-deliveries/:id/retry', tag: 'Webhooks', auth: 'webhooks.manage', summary: 'Retry a failed delivery now' }, (c, { params }) => {
    const res = db.prepare("UPDATE webhook_deliveries SET status='pending', attempts=0, next_attempt_at=?, last_error=NULL WHERE id = ? AND status = 'failed'").run(nowIso(), params.id)
    if (!res.changes) throw notFound('Failed delivery')
    audit(c, 'webhook.delivery_retried', 'webhook_delivery', params.id)
    void processDeliveries()
    return ok({ queued: true })
  })
}
