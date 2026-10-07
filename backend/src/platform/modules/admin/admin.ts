// Admin-only aggregates: global search (Ctrl+K) and the dashboard. Both only return what the actor may read.
import type { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../../../db.js'
import { env } from '../../../env.js'
import { defineRoute, ok, type PEnv } from '../../core/http.js'
import { compareVersions, fromJson, likeEscape, nowIso, pickLocale, type Localized } from '../../core/util.js'
import { campaignStats } from '../servers/servers.js'
import { getSetting } from '../config/config.js'
import { overview } from '../analytics/analytics.js'

type Hit = { type: string, id: string, title: string, subtitle?: string, link: string }

export function registerAdmin(app: Hono<PEnv>) {
  defineRoute(app, { method: 'get', path: '/search', tag: 'Admin', auth: 'user', summary: 'Global search across everything the user may read', query: z.object({ q: z.string().trim().min(2).max(60) }) }, (_c, { actor, query }) => {
    const p = `%${likeEscape(query.q)}%`
    const can = (perm: string) => actor!.permissions.has(perm)
    const hits: Hit[] = []
    const run = <T>(perm: string, sql: string, map: (r: T) => Hit) => {
      if (can(perm)) for (const r of db.prepare(sql).all(p, p) as T[]) hits.push(map(r))
    }
    run<{ id: string, title: string, slug: string, status: string }>('news.read', "SELECT id, title, slug, status FROM news WHERE title LIKE ? ESCAPE '\\' OR slug LIKE ? ESCAPE '\\' LIMIT 5",
      r => ({ type: 'news', id: r.id, title: pickLocale(fromJson<Localized>(r.title, {}), 'en') || r.slug, subtitle: r.status, link: `#/news/${r.id}` }))
    run<{ id: string, name: string, address: string }>('servers.read', "SELECT id, name, address FROM servers WHERE name LIKE ? ESCAPE '\\' OR address LIKE ? ESCAPE '\\' LIMIT 5",
      r => ({ type: 'server', id: r.id, title: r.name, subtitle: r.address, link: `#/servers/${r.id}` }))
    run<{ id: string, name: string, status: string }>('partners.read', "SELECT id, name, status FROM partners WHERE name LIKE ? ESCAPE '\\' OR contact LIKE ? ESCAPE '\\' LIMIT 5",
      r => ({ type: 'partner', id: r.id, title: r.name, subtitle: r.status, link: '#/partners' }))
    run<{ id: string, name: string, placement: string }>('partners.read', "SELECT id, name, placement FROM campaigns WHERE name LIKE ? ESCAPE '\\' OR placement LIKE ? ESCAPE '\\' LIMIT 5",
      r => ({ type: 'campaign', id: r.id, title: r.name, subtitle: r.placement, link: '#/campaigns' }))
    run<{ id: string, version: string, channel: string, status: string }>('releases.read', "SELECT id, version, channel, status FROM releases WHERE version LIKE ? ESCAPE '\\' OR channel LIKE ? ESCAPE '\\' LIMIT 5",
      r => ({ type: 'release', id: r.id, title: r.version, subtitle: `${r.channel} · ${r.status}`, link: '#/releases' }))
    run<{ id: string, username: string, mc_username: string | null }>('users.read', "SELECT id, username, mc_username FROM users WHERE username LIKE ? ESCAPE '\\' OR mc_username LIKE ? ESCAPE '\\' LIMIT 5",
      r => ({ type: 'user', id: r.id, title: r.username, subtitle: r.mc_username ?? undefined, link: '#/users' }))
    run<{ id: string, filename: string }>('assets.read', "SELECT id, filename FROM assets WHERE filename LIKE ? ESCAPE '\\' OR alt LIKE ? ESCAPE '\\' LIMIT 5",
      r => ({ type: 'asset', id: r.id, title: r.filename, link: '#/assets' }))
    run<{ key: string, description: string | null }>('config.read', "SELECT key, description FROM feature_flags WHERE key LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' LIMIT 5",
      r => ({ type: 'flag', id: r.key, title: r.key, subtitle: r.description ?? undefined, link: '#/flags' }))
    return ok(hits)
  })

  defineRoute(app, { method: 'get', path: '/dashboard', tag: 'Admin', auth: 'user', summary: 'Dashboard numbers (sections depend on permissions)' }, (_c, { actor }) => {
    const can = (perm: string) => actor!.permissions.has(perm)
    const one = (sql: string, ...a: unknown[]) => (db.prepare(sql).get(...a) as { n: number }).n
    const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()
    const out: Record<string, unknown> = { generatedAt: nowIso(), version: env.version, environment: env.appEnv, maintenance: getSetting('maintenance').enabled }
    out.users = {
      total: one('SELECT COUNT(*) AS n FROM users'),
      active24h: one('SELECT COUNT(*) AS n FROM users WHERE last_seen >= ?', ago(24)),
      active7d: one('SELECT COUNT(*) AS n FROM users WHERE last_seen >= ?', ago(24 * 7)),
      new7d: one('SELECT COUNT(*) AS n FROM users WHERE created_at >= ?', ago(24 * 7)),
    }
    if (can('analytics.read')) {
      const o = overview(14)
      out.analytics = { activeDevices14d: o.activeDevices, totals: o.totals, daily: o.daily, launcherVersions: o.launcherVersions, os: o.os }
    }
    if (can('diagnostics.read')) {
      out.diagnostics = {
        open: one("SELECT COUNT(*) AS n FROM crash_groups WHERE status = 'open'"),
        reports7d: one('SELECT COUNT(*) AS n FROM crash_reports WHERE at >= ?', ago(24 * 7)),
        byCategory: db.prepare('SELECT category AS key, COUNT(*) AS count FROM crash_reports WHERE at >= ? GROUP BY category ORDER BY count DESC').all(ago(24 * 7)),
      }
    }
    if (can('news.read')) out.content = { newsPublished: one("SELECT COUNT(*) AS n FROM news WHERE status = 'published'"), newsDrafts: one("SELECT COUNT(*) AS n FROM news WHERE status = 'draft'"), newsScheduled: one("SELECT COUNT(*) AS n FROM news WHERE status = 'scheduled'") }
    if (can('servers.read')) out.servers = { total: one('SELECT COUNT(*) AS n FROM servers'), enabled: one('SELECT COUNT(*) AS n FROM servers WHERE enabled = 1'), featured: one('SELECT COUNT(*) AS n FROM servers WHERE featured = 1') }
    if (can('partners.read')) {
      const camps = db.prepare('SELECT id, name FROM campaigns WHERE enabled = 1').all() as { id: string, name: string }[]
      out.campaigns = {
        active: camps.length,
        top: camps.map(c => ({ id: c.id, name: c.name, ...campaignStats([c.id], 30).totals })).sort((a, b) => b.impressions - a.impressions).slice(0, 5),
      }
    }
    if (can('releases.read')) {
      const best = new Map<string, { channel: string, platform: string, arch: string, version: string }>()
      for (const r of db.prepare("SELECT channel, platform, arch, version FROM releases WHERE status = 'published'").all() as { channel: string, platform: string, arch: string, version: string }[]) {
        const k = `${r.channel}/${r.platform}/${r.arch}`
        const cur = best.get(k)
        if (!cur || compareVersions(r.version, cur.version) > 0) best.set(k, r)
      }
      out.releases = [...best.values()].sort((a, b) => a.channel.localeCompare(b.channel))
    }
    return ok(out)
  })
}
