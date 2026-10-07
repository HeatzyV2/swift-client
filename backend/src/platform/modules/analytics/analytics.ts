// Privacy-first analytics and diagnostics.
//  - Only whitelisted event names with a fixed, short prop schema are accepted; unknown props are dropped.
//  - The device id is hashed with a server-side secret; IP addresses and account ids are never stored.
//  - Raw events expire after ANALYTICS_RETENTION_DAYS; per-day counters are kept for charts.
import type { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../../../db.js'
import { env } from '../../../env.js'
import { audit } from '../../core/audit.js'
import { notFound } from '../../core/errors.js'
import { emit, notify } from '../../core/events.js'
import { defineRoute, ok, paged, pageQuery, type PEnv } from '../../core/http.js'
import { hmac, newId, nowIso, sha256, toJson, fromJson } from '../../core/util.js'
import { getSetting } from '../config/config.js'
import { recordCampaignEvent } from '../servers/servers.js'

const short = z.string().trim().max(64)
const ctxSchema = z.object({
  launcherVersion: z.string().trim().max(32).optional(),
  mcVersion: z.string().trim().max(24).optional(),
  os: z.enum(['windows', 'macos', 'linux']).optional(),
  arch: z.enum(['x64', 'arm64', 'x86']).optional(),
  locale: z.string().trim().max(10).optional(),
}).default({})

export const EVENT_SCHEMAS = {
  app_open: z.object({}),
  launch_game: z.object({ mcVersion: short.optional(), loader: z.enum(['vanilla', 'fabric', 'forge', 'neoforge', 'quilt']).optional() }),
  launch_success: z.object({ durationMs: z.number().int().min(0).max(3_600_000).optional() }),
  launch_fail: z.object({ reason: short.optional() }),
  update_applied: z.object({ from: short.optional(), to: short.optional() }),
  home_view: z.object({}),
  news_open: z.object({ newsId: short }),
  campaign_impression: z.object({ campaignId: short }),
  campaign_click: z.object({ campaignId: short }),
  server_play_attempt: z.object({ campaignId: short.optional(), serverId: short.optional() }),
  server_launch: z.object({ campaignId: short.optional(), serverId: short.optional() }),
} as const
export type EventKind = keyof typeof EVENT_SCHEMAS
const EVENT_KINDS = Object.keys(EVENT_SCHEMAS) as [EventKind, ...EventKind[]]

const deviceHash = (id: string | undefined) => id ? hmac(env.analyticsSalt || `swift-analytics:${env.jwtSecret}`, id).slice(0, 24) : null

export const ingestBody = z.object({
  deviceId: z.string().trim().min(8).max(64).optional(),
  context: ctxSchema,
  events: z.array(z.object({ name: z.enum(EVENT_KINDS), props: z.record(z.string(), z.unknown()).optional() })).min(1).max(50),
})

export function ingest(body: z.output<typeof ingestBody>): number {
  if (!getSetting('analytics').enabled) return 0
  const device = deviceHash(body.deviceId)
  const ctx = body.context
  const day = nowIso().slice(0, 10)
  const insert = db.prepare('INSERT INTO analytics_events (at, name, device, launcher_version, mc_version, os, arch, locale, props) VALUES (?,?,?,?,?,?,?,?,?)')
  const daily = db.prepare('INSERT INTO analytics_daily (day, name, count) VALUES (?,?,1) ON CONFLICT(day, name) DO UPDATE SET count = count + 1')
  let accepted = 0
  db.transaction(() => {
    for (const e of body.events) {
      const parsed = EVENT_SCHEMAS[e.name].safeParse(e.props ?? {})
      if (!parsed.success) continue
      const props = parsed.data as Record<string, string | number | undefined>
      insert.run(nowIso(), e.name, device, ctx.launcherVersion ?? null, ctx.mcVersion ?? null, ctx.os ?? null, ctx.arch ?? null, ctx.locale?.slice(0, 2).toLowerCase() ?? null, Object.keys(props).length ? toJson(props) : null)
      daily.run(day, e.name)
      const cid = props.campaignId as string | undefined
      if (cid) {
        if (e.name === 'campaign_impression') recordCampaignEvent(cid, 'impression')
        else if (e.name === 'campaign_click') recordCampaignEvent(cid, 'click')
        else if (e.name === 'server_play_attempt') recordCampaignEvent(cid, 'play_attempt')
        else if (e.name === 'server_launch') recordCampaignEvent(cid, 'launch')
      }
      accepted++
    }
  })()
  return accepted
}

export function purgeAnalytics(): void {
  const cutoff = new Date(Date.now() - env.analyticsRetentionDays * 86_400_000).toISOString()
  db.prepare('DELETE FROM analytics_events WHERE at < ?').run(cutoff)
  db.prepare('DELETE FROM analytics_daily WHERE day < ?').run(new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10))
  db.prepare('DELETE FROM campaign_stats_daily WHERE day < ?').run(new Date(Date.now() - 800 * 86_400_000).toISOString().slice(0, 10))
  const crashCutoff = new Date(Date.now() - env.crashRetentionDays * 86_400_000).toISOString()
  db.prepare('DELETE FROM crash_reports WHERE at < ?').run(crashCutoff)
}

const sinceDay = (days: number) => new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10)
const sinceIso = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()

export function overview(days: number) {
  const perDay = db.prepare('SELECT day, name, count FROM analytics_daily WHERE day >= ? ORDER BY day').all(sinceDay(days)) as { day: string, name: string, count: number }[]
  const since = sinceIso(days)
  const group = (col: string) => db.prepare(`SELECT ${col} AS key, COUNT(DISTINCT device) AS devices FROM analytics_events WHERE at >= ? AND ${col} IS NOT NULL GROUP BY ${col} ORDER BY devices DESC LIMIT 12`).all(since) as { key: string, devices: number }[]
  const activeDevices = (db.prepare('SELECT COUNT(DISTINCT device) AS n FROM analytics_events WHERE at >= ? AND device IS NOT NULL').get(since) as { n: number }).n
  const totals: Record<string, number> = {}
  for (const r of perDay) totals[r.name] = (totals[r.name] ?? 0) + r.count
  const daily: Record<string, Record<string, number>> = {}
  for (const r of perDay) (daily[r.day] ??= {})[r.name] = r.count
  return {
    days, activeDevices, totals, daily: Object.entries(daily).map(([day, v]) => ({ day, ...v })),
    launcherVersions: group('launcher_version'), minecraftVersions: group('mc_version'), os: group('os'), arch: group('arch'), locales: group('locale'),
    retentionDays: env.analyticsRetentionDays,
  }
}

// ---- Diagnostics -------------------------------------------------------------------------------------

export const CRASH_CATEGORIES = [
  'launcher_crash', 'game_crash', 'java_missing', 'java_incompatible', 'modloader_install_failed', 'auth_failed',
  'network_error', 'download_failed', 'update_failed', 'disk_space', 'other',
] as const

/** Remove what could identify a person or leak a credential before a report is stored. */
export function scrub(text: string): string {
  return text
    .replace(/[A-Za-z]:\\Users\\[^\\\s"']+/gi, 'C:\\Users\\<user>')
    .replace(/\/(home|Users)\/[^/\s"']+/g, '/$1/<user>')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '<email>')
    .replace(/(bearer|token|authorization|password|secret|key)(["':=\s]+)[A-Za-z0-9._~+/=-]{8,}/gi, '$1$2<redacted>')
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, '<redacted>')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '<ip>')
}

const reportBody = z.object({
  category: z.enum(CRASH_CATEGORIES),
  code: z.string().trim().max(40).optional(),
  message: z.string().max(2000).optional(),
  deviceId: z.string().trim().min(8).max(64).optional(),
  context: ctxSchema,
  details: z.record(z.string().max(40), z.union([z.string().max(300), z.number(), z.boolean()])).refine(o => Object.keys(o).length <= 20).optional(),
})

type GroupRow = { fingerprint: string, category: string, title: string | null, first_seen: string, last_seen: string, occurrences: number, status: string }

export function recordReport(b: z.output<typeof reportBody>): string {
  const message = scrub(b.message ?? '').slice(0, 1000)
  const firstLine = message.split('\n')[0].replace(/\d+/g, '#').slice(0, 120)
  const fingerprint = sha256(`${b.category}|${b.code ?? ''}|${firstLine}`).slice(0, 16)
  const id = newId(14)
  const now = nowIso()
  const details = b.details ? Object.fromEntries(Object.entries(b.details).map(([k, v]) => [k, typeof v === 'string' ? scrub(v) : v])) : null
  db.transaction(() => {
    db.prepare('INSERT INTO crash_reports (id, at, category, code, message, fingerprint, device, launcher_version, mc_version, os, arch, details) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(id, now, b.category, b.code ?? null, message, fingerprint, deviceHash(b.deviceId), b.context.launcherVersion ?? null, b.context.mcVersion ?? null, b.context.os ?? null, b.context.arch ?? null, details ? toJson(details) : null)
    const g = db.prepare('SELECT 1 FROM crash_groups WHERE fingerprint = ?').get(fingerprint)
    if (g) {
      db.prepare("UPDATE crash_groups SET last_seen = ?, occurrences = occurrences + 1, status = CASE WHEN status = 'resolved' THEN 'open' ELSE status END WHERE fingerprint = ?").run(now, fingerprint)
    } else {
      db.prepare('INSERT INTO crash_groups (fingerprint, category, title, first_seen, last_seen) VALUES (?,?,?,?,?)').run(fingerprint, b.category, (b.code ? `${b.code}: ` : '') + firstLine, now, now)
      notify('warning', `New ${b.category.replace(/_/g, ' ')} issue`, firstLine, '#/diagnostics', 'diagnostics.read')
      emit('crash.new_group', { fingerprint, category: b.category, title: firstLine })
    }
  })()
  return fingerprint
}

export function registerAnalytics(app: Hono<PEnv>) {
  defineRoute(app, { method: 'post', path: '/analytics/events', tag: 'Analytics', auth: 'public', rate: 'ingest', summary: 'Ingest whitelisted launcher events (pseudonymous)', body: ingestBody }, (c, { body }) => {
    const accepted = ingest(body)
    return new Response(JSON.stringify({ success: true, data: { accepted }, meta: { requestId: c.get('requestId') } }), { status: 202, headers: { 'Content-Type': 'application/json; charset=UTF-8' } })
  })

  defineRoute(app, { method: 'get', path: '/analytics/overview', tag: 'Analytics', auth: 'analytics.read', summary: 'Aggregated usage for the last N days', query: z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }) }, (_c, { query }) =>
    ok(overview(query.days)))

  defineRoute(app, { method: 'post', path: '/diagnostics/report', tag: 'Diagnostics', auth: 'public', rate: 'ingest', summary: 'Submit a categorized, scrubbed error report', body: reportBody }, (c, { body }) => {
    const fingerprint = recordReport(body)
    return new Response(JSON.stringify({ success: true, data: { fingerprint }, meta: { requestId: c.get('requestId') } }), { status: 202, headers: { 'Content-Type': 'application/json; charset=UTF-8' } })
  })

  defineRoute(app, {
    method: 'get', path: '/diagnostics/groups', tag: 'Diagnostics', auth: 'diagnostics.read', summary: 'Grouped error reports',
    query: pageQuery.extend({ category: z.enum(CRASH_CATEGORIES).optional(), status: z.enum(['open', 'resolved', 'ignored']).optional() }),
  }, (_c, { query }) => {
    const where: string[] = []
    const args: unknown[] = []
    if (query.category) { where.push('category = ?'); args.push(query.category) }
    if (query.status) { where.push('status = ?'); args.push(query.status) }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const total = (db.prepare(`SELECT COUNT(*) AS n FROM crash_groups ${w}`).get(...args) as { n: number }).n
    const rows = db.prepare(`SELECT * FROM crash_groups ${w} ORDER BY last_seen DESC LIMIT ? OFFSET ?`).all(...args, query.limit, (query.page - 1) * query.limit) as GroupRow[]
    return paged(rows.map(g => ({ fingerprint: g.fingerprint, category: g.category, title: g.title, firstSeen: g.first_seen, lastSeen: g.last_seen, occurrences: g.occurrences, status: g.status })), total, query.page, query.limit)
  })

  defineRoute(app, { method: 'get', path: '/diagnostics/groups/:fingerprint', tag: 'Diagnostics', auth: 'diagnostics.read', summary: 'One error group with recent reports and breakdown' }, (_c, { params }) => {
    const g = db.prepare('SELECT * FROM crash_groups WHERE fingerprint = ?').get(params.fingerprint) as GroupRow | undefined
    if (!g) throw notFound('Error group')
    const reports = (db.prepare('SELECT id, at, code, message, launcher_version, mc_version, os, arch, details FROM crash_reports WHERE fingerprint = ? ORDER BY at DESC LIMIT 25').all(g.fingerprint) as Record<string, string | null>[])
      .map(r => ({ id: r.id, at: r.at, code: r.code, message: r.message, launcherVersion: r.launcher_version, mcVersion: r.mc_version, os: r.os, arch: r.arch, details: fromJson(r.details, null) }))
    const by = (col: string) => db.prepare(`SELECT ${col} AS key, COUNT(*) AS count FROM crash_reports WHERE fingerprint = ? AND ${col} IS NOT NULL GROUP BY ${col} ORDER BY count DESC LIMIT 8`).all(g.fingerprint)
    return ok({ group: { fingerprint: g.fingerprint, category: g.category, title: g.title, firstSeen: g.first_seen, lastSeen: g.last_seen, occurrences: g.occurrences, status: g.status }, reports, byLauncherVersion: by('launcher_version'), byOs: by('os') })
  })

  defineRoute(app, {
    method: 'post', path: '/diagnostics/groups/:fingerprint/status', tag: 'Diagnostics', auth: 'diagnostics.write', summary: 'Mark a group open, resolved or ignored',
    body: z.object({ status: z.enum(['open', 'resolved', 'ignored']) }),
  }, (c, { params, body }) => {
    const res = db.prepare('UPDATE crash_groups SET status = ? WHERE fingerprint = ?').run(body.status, params.fingerprint)
    if (!res.changes) throw notFound('Error group')
    audit(c, 'diagnostics.status', 'crash_group', params.fingerprint, { after: body })
    return ok({ fingerprint: params.fingerprint, status: body.status })
  })
}
