// Public launcher API: one aggregate bootstrap call plus focused endpoints. Everything is resolved for the
// client's locale and context (version, OS, arch, auth state, rollout bucket) and is safe to cache.
import type { Hono } from 'hono'
import { z } from 'zod'
import { env } from '../../../env.js'
import { badRequest } from '../../core/errors.js'
import { cached, defineRoute, ok, type PEnv } from '../../core/http.js'
import { channel, arch as archSchema, platform as platformSchema, clientContextQuery, inWindow, matches, toContext, version, type ClientContext } from '../../core/schemas.js'
import { pickLocale, type Localized } from '../../core/util.js'
import { activeAnnouncements } from '../cms/news.js'
import { activeSnapshot, draftSections, type HomeSection } from '../cms/home.js'
import { publishedChangelog, publishedNews } from '../cms/news.js'
import { evaluateFlags, remoteConfig } from '../config/routes.js'
import { getSetting, maintenanceState } from '../config/config.js'
import { checkUpdate, tauriPayload } from '../releases/releases.js'
import { activeCampaigns, publicServers } from '../servers/servers.js'
import { resolveImage } from '../assets/service.js'
import { describeNews } from '../cms/news.js'
import { fromJson } from '../../core/util.js'

type NewsRowLike = Parameters<typeof describeNews>[0]

function renderNews(r: NewsRowLike, locale: string) {
  const n = describeNews(r)
  return {
    id: n.id, slug: n.slug, title: pickLocale(n.title, locale), summary: pickLocale(n.summary, locale), body: pickLocale(n.body, locale),
    imageUrl: n.imageUrl, url: n.url, direct: n.direct, category: n.category, pinned: n.pinned, date: n.publishedAt ?? n.publishAt ?? n.createdAt,
  }
}

function renderServer(s: ReturnType<typeof publicServers>[number], locale: string) {
  return {
    id: s.id, name: s.name, edition: s.edition, address: s.address, port: s.port, bedrock: s.bedrock, minVersion: s.minVersion, maxVersion: s.maxVersion,
    description: pickLocale(s.description, locale), iconUrl: s.iconUrl, bannerUrl: s.bannerUrl, website: s.website, tags: s.tags, featured: s.featured, verified: s.verified,
  }
}

function renderCampaign(c: ReturnType<typeof activeCampaigns>[number], locale: string) {
  const cr = c.creative as { title?: Localized, subtitle?: Localized, imageUrl?: string | null, cta?: { label: Localized, url: string } | null }
  const server = c.serverId ? publicServers().find(s => s.id === c.serverId) : undefined
  return {
    id: c.id, placement: c.placement, title: pickLocale(cr.title, locale), subtitle: pickLocale(cr.subtitle, locale), imageUrl: cr.imageUrl ?? null,
    cta: cr.cta ? { label: pickLocale(cr.cta.label, locale), url: cr.cta.url } : null,
    server: server ? { id: server.id, name: server.name, address: server.address, port: server.port } : null,
  }
}

const L = (v: unknown, locale: string) => pickLocale(v as Localized, locale)

export function renderHome(sections: HomeSection[], ctx: ClientContext) {
  const locale = ctx.locale ?? 'en'
  const out: Record<string, unknown>[] = []
  for (const s of sections) {
    if (!s.enabled || !inWindow(s.startsAt, s.endsAt) || !matches(s.targeting, ctx, s.id)) continue
    const cfg = s.config as Record<string, any>
    const base = { id: s.id, kind: s.kind, title: L(s.title, locale) }
    switch (s.kind) {
      case 'hero':
        out.push({ ...base, subtitle: L(cfg.subtitle, locale), badge: L(cfg.badge, locale), imageUrl: resolveImage(cfg.image), cta: cfg.cta ? { label: L(cfg.cta.label, locale), url: cfg.cta.url } : null })
        break
      case 'news':
        out.push({ ...base, items: publishedNews(cfg.limit ?? 4).map(n => renderNews(n, locale)) })
        break
      case 'servers': {
        const list = publicServers().filter(x => cfg.mode === 'all' || x.featured).slice(0, cfg.limit ?? 6)
        out.push({ ...base, items: list.map(x => renderServer(x, locale)) })
        break
      }
      case 'partners':
        out.push({ ...base, items: activeCampaigns(ctx, 'home_banner').slice(0, cfg.limit ?? 3).map(c => renderCampaign(c, locale)) })
        break
      case 'banner':
        out.push({ ...base, imageUrl: resolveImage(cfg.image), url: cfg.url ?? null, alt: L(cfg.alt, locale) })
        break
      case 'links':
        out.push({ ...base, items: (cfg.items as { label: Localized, url: string, icon?: string }[]).map(i => ({ label: L(i.label, locale), url: i.url, icon: i.icon ?? null })) })
        break
      case 'text':
        out.push({ ...base, body: L(cfg.body, locale) })
        break
    }
  }
  return out
}

const updateQuery = clientContextQuery.extend({ channel: channel.default('stable'), platform: platformSchema.optional(), version: version.optional() })

function updateFor(ctx: ClientContext, platform: string | undefined, arch: string | undefined, current: string | undefined, channelName: string) {
  const p = platform ?? ctx.os
  const a = arch ?? ctx.arch
  if (!p || !a || !current) throw badRequest('platform, arch and version are required')
  return checkUpdate({ ...ctx, channel: channelName }, p, a, current)
}

export function registerLauncher(app: Hono<PEnv>) {
  defineRoute(app, { method: 'get', path: '/launcher/bootstrap', tag: 'Launcher', auth: 'public', summary: 'Everything the launcher needs at startup, in one call', query: clientContextQuery.extend({ channel: channel.default('stable') }) }, (_c, { query }) => {
    const ctx = { ...toContext(query), channel: query.channel }
    const locale = ctx.locale ?? 'en'
    const snap = activeSnapshot()
    const flags = evaluateFlags(ctx)
    const canUpdate = ctx.os && ctx.arch && ctx.launcherVersion
    return cached({
      apiVersion: 1,
      maintenance: maintenanceState(ctx),
      announcements: activeAnnouncements(ctx).map(a => ({ id: a.id, type: a.type, title: pickLocale(a.title, locale), body: pickLocale(a.body, locale), linkUrl: a.linkUrl, dismissible: a.dismissible })),
      home: snap ? { snapshotId: snap.id, sections: renderHome(snap.sections, ctx) } : null,
      news: publishedNews(10).map(n => renderNews(n, locale)),
      changelog: publishedChangelog(10).map(e => ({ version: e.version, date: e.date, items: e.items.map(i => pickLocale(i, locale)) })),
      servers: publicServers().map(s => renderServer(s, locale)),
      campaigns: activeCampaigns(ctx).map(c => renderCampaign(c, locale)),
      flags: flags.flags,
      experiments: flags.experiments,
      config: remoteConfig(),
      links: getSetting('links'),
      analytics: getSetting('analytics'),
      update: canUpdate ? updateFor(ctx, undefined, undefined, ctx.launcherVersion, query.channel) : null,
    }, env.publicCacheSec, { serverTime: new Date().toISOString() })
  })

  defineRoute(app, { method: 'get', path: '/launcher/update', tag: 'Launcher', auth: 'public', summary: 'Is a newer launcher available for this channel, platform and architecture?', query: updateQuery }, (_c, { query }) => {
    const ctx = { ...toContext(query), channel: query.channel }
    return cached(updateFor(ctx, query.platform, query.arch, query.version ?? query.v, query.channel), env.publicCacheSec)
  })

  // Tauri updater endpoint format: 200 { version, notes, pub_date, url, signature } or 204.
  defineRoute(app, { method: 'get', path: '/launcher/update/tauri/:platform/:arch/:current', tag: 'Launcher', auth: 'public', summary: 'Update check in the Tauri updater format (204 when up to date)', query: z.object({ channel: channel.default('stable'), locale: z.string().max(10).optional(), device: z.string().max(64).optional() }) }, (c, { params, query }) => {
    const p = platformSchema.safeParse(params.platform === 'darwin' ? 'macos' : params.platform)
    const a = archSchema.safeParse(params.arch === 'x86_64' ? 'x64' : params.arch === 'aarch64' ? 'arm64' : params.arch)
    if (!p.success || !a.success || !version.safeParse(params.current).success) throw badRequest('Invalid platform, arch or version')
    const u = checkUpdate({ channel: query.channel, device: query.device, locale: query.locale }, p.data, a.data, params.current)
    const payload = tauriPayload(u, query.locale)
    if (!payload) return new Response(null, { status: 204 })
    return new Response(JSON.stringify(payload), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${env.publicCacheSec}` } })
  })

  defineRoute(app, { method: 'get', path: '/launcher/news', tag: 'Launcher', auth: 'public', summary: 'Published news (localized)', query: clientContextQuery }, (_c, { query }) => {
    const locale = toContext(query).locale ?? 'en'
    return cached(publishedNews(20).map(n => renderNews(n, locale)), env.publicCacheSec)
  })

  defineRoute(app, { method: 'get', path: '/launcher/servers', tag: 'Launcher', auth: 'public', summary: 'Enabled servers (localized)', query: clientContextQuery }, (_c, { query }) => {
    const locale = toContext(query).locale ?? 'en'
    return cached(publicServers().map(s => renderServer(s, locale)), env.publicCacheSec)
  })

  defineRoute(app, { method: 'get', path: '/launcher/maintenance', tag: 'Launcher', auth: 'public', summary: 'Maintenance state', query: clientContextQuery }, (_c, { query }) =>
    cached(maintenanceState(toContext(query)), 15))

  // Admin preview of the unpublished draft, rendered exactly like the launcher would.
  defineRoute(app, { method: 'get', path: '/home/preview', tag: 'Home', auth: 'home.read', summary: 'Render the draft home for a given client context', query: clientContextQuery }, (_c, { query }) => {
    const ctx = toContext(query)
    return ok({ sections: renderHome(draftSections(), { ...ctx, device: ctx.device ?? 'preview', channel: ctx.channel ?? 'stable' }) })
  })
}

export { fromJson }
