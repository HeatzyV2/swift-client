// Servers, partners and campaigns (with daily stats). Public reads go through the in-process cache;
// every admin write invalidates the 'servers' tag.
import type { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../../../db.js'
import { audit } from '../../core/audit.js'
import { cache } from '../../core/cache.js'
import { badRequest, conflict, notFound } from '../../core/errors.js'
import { emit } from '../../core/events.js'
import { created, defineRoute, ok, paged, pageQuery, type PEnv } from '../../core/http.js'
import { imageRef, inWindow, isoDate, localized, matches, optionalLocalized, safeUrl, slug, targetingSchema, type ClientContext, type Targeting } from '../../core/schemas.js'
import { fromJson, likeEscape, newId, nowIso, toJson, type Localized } from '../../core/util.js'
import { resolveImage } from '../assets/service.js'

const host = z.string().trim().min(1).max(253).regex(/^[A-Za-z0-9]([A-Za-z0-9.:-]*[A-Za-z0-9])?$/, 'Hostname or IP without scheme or port')
const mcVersion = z.string().trim().regex(/^\d+\.\d+(\.\d+)?$/, 'Minecraft version like 1.21.4')

const serverInput = z.object({
  name: z.string().trim().min(2).max(60),
  slug: slug.optional(),
  edition: z.enum(['java', 'bedrock', 'crossplay']).default('java'),
  address: host,
  port: z.number().int().min(1).max(65535).default(25565),
  bedrockAddress: host.nullable().optional(),
  bedrockPort: z.number().int().min(1).max(65535).nullable().optional(),
  minVersion: mcVersion.nullable().optional(),
  maxVersion: mcVersion.nullable().optional(),
  description: optionalLocalized(400),
  icon: imageRef.nullable().optional(),
  banner: imageRef.nullable().optional(),
  website: safeUrl.nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(24)).max(10).default([]),
  featured: z.boolean().default(false),
  verified: z.boolean().default(false),
  ingame: z.boolean().default(false),
  enabled: z.boolean().default(true),
  position: z.number().int().min(0).max(9999).default(0),
})

type ServerRow = {
  id: string, slug: string, name: string, edition: string, address: string, port: number, bedrock_address: string | null, bedrock_port: number | null,
  min_version: string | null, max_version: string | null, description: string, icon: string | null, banner: string | null, website: string | null,
  tags: string, featured: number, verified: number, ingame: number, enabled: number, position: number, created_at: string, updated_at: string,
}

export function describeServer(r: ServerRow) {
  return {
    id: r.id, slug: r.slug, name: r.name, edition: r.edition, address: r.address, port: r.port,
    bedrock: r.bedrock_address || r.bedrock_port ? { address: r.bedrock_address ?? r.address, port: r.bedrock_port ?? 19132 } : null,
    minVersion: r.min_version, maxVersion: r.max_version, description: fromJson<Localized>(r.description, {}),
    icon: r.icon, iconUrl: resolveImage(r.icon), banner: r.banner, bannerUrl: resolveImage(r.banner), website: r.website,
    tags: fromJson<string[]>(r.tags, []), featured: !!r.featured, verified: !!r.verified, ingame: !!r.ingame, enabled: !!r.enabled,
    position: r.position, createdAt: r.created_at, updatedAt: r.updated_at,
  }
}

export function publicServers(): ReturnType<typeof describeServer>[] {
  return cache.get('servers:public', 30_000, ['servers'], () =>
    (db.prepare('SELECT * FROM servers WHERE enabled = 1 ORDER BY featured DESC, position, name').all() as ServerRow[]).map(describeServer))
}

function uniqueSlug(base: string, exceptId = ''): string {
  let s = base || 'server'
  for (let i = 2; db.prepare('SELECT 1 FROM servers WHERE slug = ? AND id != ?').get(s, exceptId); i++) s = `${base}-${i}`
  return s
}
const slugify = (n: string) => n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)

// ---- Campaigns --------------------------------------------------------------------------------------

export const PLACEMENTS = ['home_banner', 'ingame_slot', 'server_list', 'announcement'] as const

const campaignInput = z.object({
  partnerId: z.string().max(40).nullable().optional(),
  serverId: z.string().max(40).nullable().optional(),
  name: z.string().trim().min(2).max(80),
  placement: z.enum(PLACEMENTS),
  creative: z.object({
    title: optionalLocalized(80), subtitle: optionalLocalized(160), image: imageRef.nullable().optional(),
    cta: z.object({ label: localized(40), url: safeUrl }).strict().nullable().optional(),
  }).strict().default({ title: {}, subtitle: {} }),
  priority: z.number().int().min(0).max(1000).default(0),
  enabled: z.boolean().default(true),
  startsAt: isoDate.nullable().optional(),
  endsAt: isoDate.nullable().optional(),
  targeting: targetingSchema.default({}),
})

type CampaignRow = {
  id: string, partner_id: string | null, server_id: string | null, name: string, placement: string, creative: string, priority: number,
  enabled: number, starts_at: string | null, ends_at: string | null, targeting: string, created_at: string, updated_at: string,
}

export function describeCampaign(r: CampaignRow) {
  const creative = fromJson<Record<string, unknown>>(r.creative, {})
  return {
    id: r.id, partnerId: r.partner_id, serverId: r.server_id, name: r.name, placement: r.placement,
    creative: { ...creative, imageUrl: resolveImage(creative.image as string | undefined) },
    priority: r.priority, enabled: !!r.enabled, startsAt: r.starts_at, endsAt: r.ends_at,
    targeting: fromJson<Targeting>(r.targeting, {}), createdAt: r.created_at, updatedAt: r.updated_at,
  }
}

export function activeCampaigns(ctx: ClientContext, placement?: string) {
  const rows = cache.get('campaigns:active', 30_000, ['servers'], () =>
    db.prepare(`SELECT c.* FROM campaigns c LEFT JOIN partners p ON p.id = c.partner_id
      WHERE c.enabled = 1 AND (p.id IS NULL OR p.status = 'active') ORDER BY c.priority DESC, c.created_at`).all() as CampaignRow[])
  return rows
    .filter(r => (!placement || r.placement === placement) && inWindow(r.starts_at, r.ends_at) && matches(fromJson<Targeting>(r.targeting, {}), ctx, r.id))
    .map(describeCampaign)
}

export type CampaignEvent = 'impression' | 'click' | 'play_attempt' | 'launch'
const COLUMN: Record<CampaignEvent, string> = { impression: 'impressions', click: 'clicks', play_attempt: 'play_attempts', launch: 'launches' }

/** Called by analytics ingestion: unknown campaign ids are ignored, so clients cannot create rows. */
export function recordCampaignEvent(campaignId: string, kind: CampaignEvent): void {
  if (!db.prepare('SELECT 1 FROM campaigns WHERE id = ?').get(campaignId)) return
  const col = COLUMN[kind]
  db.prepare(`INSERT INTO campaign_stats_daily (campaign_id, day, ${col}) VALUES (?, ?, 1)
    ON CONFLICT(campaign_id, day) DO UPDATE SET ${col} = ${col} + 1`).run(campaignId, nowIso().slice(0, 10))
}

type Totals = { impressions: number, clicks: number, play_attempts: number, launches: number }
const withRates = (t: Totals) => ({
  impressions: t.impressions, clicks: t.clicks, playAttempts: t.play_attempts, launches: t.launches,
  ctr: t.impressions ? +(t.clicks / t.impressions * 100).toFixed(2) : 0,
  launchRate: t.clicks ? +(t.launches / t.clicks * 100).toFixed(2) : 0,
})

export function campaignStats(ids: string[], days: number) {
  const from = new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10)
  if (!ids.length) return { totals: withRates({ impressions: 0, clicks: 0, play_attempts: 0, launches: 0 }), daily: [] }
  const marks = ids.map(() => '?').join(',')
  const daily = db.prepare(`SELECT day, SUM(impressions) AS impressions, SUM(clicks) AS clicks, SUM(play_attempts) AS play_attempts, SUM(launches) AS launches
    FROM campaign_stats_daily WHERE campaign_id IN (${marks}) AND day >= ? GROUP BY day ORDER BY day`).all(...ids, from) as (Totals & { day: string })[]
  const totals = daily.reduce((a, d) => ({ impressions: a.impressions + d.impressions, clicks: a.clicks + d.clicks, play_attempts: a.play_attempts + d.play_attempts, launches: a.launches + d.launches }), { impressions: 0, clicks: 0, play_attempts: 0, launches: 0 })
  return { totals: withRates(totals), daily: daily.map(d => ({ day: d.day, ...withRates(d) })) }
}

/** Servers shown in the game's list, for the legacy /api/servers and /api/partners/ingame contract. */
export function legacyIngameSlots(): { name: string, ip: string, port: number }[] | null {
  const rows = db.prepare("SELECT * FROM servers WHERE enabled = 1 AND ingame = 1 AND edition != 'bedrock' ORDER BY featured DESC, position, name").all() as ServerRow[]
  const sponsored = db.prepare(`SELECT s.* FROM campaigns c JOIN servers s ON s.id = c.server_id LEFT JOIN partners p ON p.id = c.partner_id
    WHERE c.enabled = 1 AND c.placement = 'ingame_slot' AND s.enabled = 1 AND s.edition != 'bedrock' AND (p.id IS NULL OR p.status = 'active')
      AND (c.starts_at IS NULL OR c.starts_at <= ?) AND (c.ends_at IS NULL OR c.ends_at > ?) AND c.targeting = '{}' ORDER BY c.priority DESC`).all(nowIso(), nowIso()) as ServerRow[]
  const all = [...sponsored, ...rows]
  if (!all.length) return null
  const seen = new Set<string>()
  return all.filter(s => !seen.has(s.id) && seen.add(s.id)).map(s => ({ name: s.name, ip: s.address, port: s.port }))
}

// ---- Routes -----------------------------------------------------------------------------------------

type PartnerRow = { id: string, name: string, contact: string | null, website: string | null, notes: string | null, status: string, created_at: string, updated_at: string }
const describePartner = (r: PartnerRow) => ({ id: r.id, name: r.name, contact: r.contact, website: r.website, notes: r.notes, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at })

const partnerInput = z.object({
  name: z.string().trim().min(2).max(80),
  contact: z.string().trim().max(200).nullable().optional(),
  website: safeUrl.nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(['active', 'paused', 'ended']).default('active'),
})

const statsQuery = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) })

export function registerServers(app: Hono<PEnv>) {
  // Servers
  defineRoute(app, { method: 'get', path: '/servers', tag: 'Servers', auth: 'servers.read', summary: 'List servers', query: pageQuery.extend({ edition: z.enum(['java', 'bedrock', 'crossplay']).optional() }) }, (_c, { query }) => {
    const where: string[] = []
    const args: unknown[] = []
    if (query.edition) { where.push('edition = ?'); args.push(query.edition) }
    if (query.q) { where.push("(name LIKE ? ESCAPE '\\' OR address LIKE ? ESCAPE '\\')"); const p = `%${likeEscape(query.q)}%`; args.push(p, p) }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const total = (db.prepare(`SELECT COUNT(*) AS n FROM servers ${w}`).get(...args) as { n: number }).n
    const rows = db.prepare(`SELECT * FROM servers ${w} ORDER BY featured DESC, position, name LIMIT ? OFFSET ?`).all(...args, query.limit, (query.page - 1) * query.limit) as ServerRow[]
    return paged(rows.map(describeServer), total, query.page, query.limit)
  })

  defineRoute(app, { method: 'get', path: '/servers/:id', tag: 'Servers', auth: 'servers.read', summary: 'Server detail' }, (_c, { params }) => {
    const r = db.prepare('SELECT * FROM servers WHERE id = ?').get(params.id) as ServerRow | undefined
    if (!r) throw notFound('Server')
    return ok(describeServer(r))
  })

  const writeServer = (id: string, b: z.output<typeof serverInput>, isNew: boolean) => {
    if (b.edition === 'crossplay' && !b.bedrockPort && !b.bedrockAddress) throw badRequest('Crossplay servers need a Bedrock address or port')
    if (b.minVersion && b.maxVersion && b.minVersion.localeCompare(b.maxVersion, undefined, { numeric: true }) > 0) throw badRequest('minVersion is greater than maxVersion')
    const now = nowIso()
    const slugValue = uniqueSlug(b.slug ?? slugify(b.name), isNew ? '' : id)
    if (isNew) {
      db.prepare(`INSERT INTO servers (id, slug, name, edition, address, port, bedrock_address, bedrock_port, min_version, max_version, description, icon, banner, website, tags, featured, verified, ingame, enabled, position, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, slugValue, b.name, b.edition, b.address, b.port, b.bedrockAddress ?? null, b.bedrockPort ?? null, b.minVersion ?? null, b.maxVersion ?? null, toJson(b.description), b.icon ?? null, b.banner ?? null, b.website ?? null, toJson(b.tags), b.featured ? 1 : 0, b.verified ? 1 : 0, b.ingame ? 1 : 0, b.enabled ? 1 : 0, b.position, now, now)
    } else {
      db.prepare(`UPDATE servers SET slug=?, name=?, edition=?, address=?, port=?, bedrock_address=?, bedrock_port=?, min_version=?, max_version=?, description=?, icon=?, banner=?, website=?, tags=?, featured=?, verified=?, ingame=?, enabled=?, position=?, updated_at=? WHERE id=?`)
        .run(slugValue, b.name, b.edition, b.address, b.port, b.bedrockAddress ?? null, b.bedrockPort ?? null, b.minVersion ?? null, b.maxVersion ?? null, toJson(b.description), b.icon ?? null, b.banner ?? null, b.website ?? null, toJson(b.tags), b.featured ? 1 : 0, b.verified ? 1 : 0, b.ingame ? 1 : 0, b.enabled ? 1 : 0, b.position, now, id)
    }
    cache.invalidate('servers')
  }

  defineRoute(app, { method: 'post', path: '/servers', tag: 'Servers', auth: 'servers.write', summary: 'Create a server', body: serverInput }, (c, { body }) => {
    const id = newId(12)
    writeServer(id, body, true)
    audit(c, 'server.created', 'server', id, { summary: body.name, after: body })
    emit('server.created', { id, name: body.name })
    return created(describeServer(db.prepare('SELECT * FROM servers WHERE id = ?').get(id) as ServerRow))
  })

  defineRoute(app, { method: 'put', path: '/servers/:id', tag: 'Servers', auth: 'servers.write', summary: 'Update a server', body: serverInput }, (c, { params, body }) => {
    const row = db.prepare('SELECT * FROM servers WHERE id = ?').get(params.id) as ServerRow | undefined
    if (!row) throw notFound('Server')
    writeServer(row.id, body, false)
    audit(c, 'server.updated', 'server', row.id, { summary: body.name, before: describeServer(row), after: body })
    return ok(describeServer(db.prepare('SELECT * FROM servers WHERE id = ?').get(row.id) as ServerRow))
  })

  defineRoute(app, { method: 'delete', path: '/servers/:id', tag: 'Servers', auth: 'servers.write', summary: 'Delete a server (campaigns keep existing, unlinked)' }, (c, { params }) => {
    const row = db.prepare('SELECT * FROM servers WHERE id = ?').get(params.id) as ServerRow | undefined
    if (!row) throw notFound('Server')
    db.prepare('DELETE FROM servers WHERE id = ?').run(row.id)
    cache.invalidate('servers')
    audit(c, 'server.deleted', 'server', row.id, { summary: row.name, before: describeServer(row) })
    return ok({ deleted: true })
  })

  // Partners
  defineRoute(app, { method: 'get', path: '/partners', tag: 'Partners', auth: 'partners.read', summary: 'List partners' }, () =>
    ok((db.prepare('SELECT * FROM partners ORDER BY name').all() as PartnerRow[]).map(describePartner)))

  defineRoute(app, { method: 'post', path: '/partners', tag: 'Partners', auth: 'partners.write', summary: 'Create a partner', body: partnerInput }, (c, { body }) => {
    const id = newId(12)
    const now = nowIso()
    db.prepare('INSERT INTO partners (id, name, contact, website, notes, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)').run(id, body.name, body.contact ?? null, body.website ?? null, body.notes ?? null, body.status, now, now)
    cache.invalidate('servers')
    audit(c, 'partner.created', 'partner', id, { summary: body.name, after: body })
    return created(describePartner(db.prepare('SELECT * FROM partners WHERE id = ?').get(id) as PartnerRow))
  })

  defineRoute(app, { method: 'put', path: '/partners/:id', tag: 'Partners', auth: 'partners.write', summary: 'Update a partner', body: partnerInput }, (c, { params, body }) => {
    const row = db.prepare('SELECT * FROM partners WHERE id = ?').get(params.id) as PartnerRow | undefined
    if (!row) throw notFound('Partner')
    db.prepare('UPDATE partners SET name=?, contact=?, website=?, notes=?, status=?, updated_at=? WHERE id=?').run(body.name, body.contact ?? null, body.website ?? null, body.notes ?? null, body.status, nowIso(), row.id)
    cache.invalidate('servers')
    audit(c, 'partner.updated', 'partner', row.id, { summary: body.name, before: describePartner(row), after: body })
    return ok(describePartner(db.prepare('SELECT * FROM partners WHERE id = ?').get(row.id) as PartnerRow))
  })

  defineRoute(app, { method: 'delete', path: '/partners/:id', tag: 'Partners', auth: 'partners.write', summary: 'Delete a partner without campaigns' }, (c, { params }) => {
    const row = db.prepare('SELECT * FROM partners WHERE id = ?').get(params.id) as PartnerRow | undefined
    if (!row) throw notFound('Partner')
    if (db.prepare('SELECT 1 FROM campaigns WHERE partner_id = ?').get(row.id)) throw conflict('Delete or reassign this partner\'s campaigns first')
    db.prepare('DELETE FROM partners WHERE id = ?').run(row.id)
    audit(c, 'partner.deleted', 'partner', row.id, { summary: row.name, before: describePartner(row) })
    return ok({ deleted: true })
  })

  defineRoute(app, { method: 'get', path: '/partners/:id/stats', tag: 'Partners', auth: 'partners.read', summary: 'Aggregated campaign stats of a partner', query: statsQuery }, (_c, { params, query }) => {
    if (!db.prepare('SELECT 1 FROM partners WHERE id = ?').get(params.id)) throw notFound('Partner')
    const ids = (db.prepare('SELECT id FROM campaigns WHERE partner_id = ?').all(params.id) as { id: string }[]).map(r => r.id)
    return ok(campaignStats(ids, query.days))
  })

  // Campaigns
  const checkRefs = (b: z.output<typeof campaignInput>) => {
    if (b.partnerId && !db.prepare('SELECT 1 FROM partners WHERE id = ?').get(b.partnerId)) throw badRequest('Unknown partnerId')
    if (b.serverId && !db.prepare('SELECT 1 FROM servers WHERE id = ?').get(b.serverId)) throw badRequest('Unknown serverId')
    if (b.startsAt && b.endsAt && b.startsAt >= b.endsAt) throw badRequest('endsAt must be after startsAt')
  }

  defineRoute(app, { method: 'get', path: '/campaigns', tag: 'Campaigns', auth: 'partners.read', summary: 'List campaigns' }, () =>
    ok((db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC LIMIT 300').all() as CampaignRow[]).map(describeCampaign)))

  defineRoute(app, { method: 'post', path: '/campaigns', tag: 'Campaigns', auth: 'partners.write', summary: 'Create a campaign', body: campaignInput }, (c, { body }) => {
    checkRefs(body)
    const id = newId(12)
    const now = nowIso()
    db.prepare(`INSERT INTO campaigns (id, partner_id, server_id, name, placement, creative, priority, enabled, starts_at, ends_at, targeting, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, body.partnerId ?? null, body.serverId ?? null, body.name, body.placement, toJson(body.creative), body.priority, body.enabled ? 1 : 0, body.startsAt ?? null, body.endsAt ?? null, toJson(body.targeting), now, now)
    cache.invalidate('servers')
    audit(c, 'campaign.created', 'campaign', id, { summary: body.name, after: body })
    emit('campaign.created', { id, name: body.name, placement: body.placement })
    return created(describeCampaign(db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id) as CampaignRow))
  })

  defineRoute(app, { method: 'put', path: '/campaigns/:id', tag: 'Campaigns', auth: 'partners.write', summary: 'Update a campaign', body: campaignInput }, (c, { params, body }) => {
    const row = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(params.id) as CampaignRow | undefined
    if (!row) throw notFound('Campaign')
    checkRefs(body)
    db.prepare(`UPDATE campaigns SET partner_id=?, server_id=?, name=?, placement=?, creative=?, priority=?, enabled=?, starts_at=?, ends_at=?, targeting=?, updated_at=? WHERE id=?`)
      .run(body.partnerId ?? null, body.serverId ?? null, body.name, body.placement, toJson(body.creative), body.priority, body.enabled ? 1 : 0, body.startsAt ?? null, body.endsAt ?? null, toJson(body.targeting), nowIso(), row.id)
    cache.invalidate('servers')
    audit(c, 'campaign.updated', 'campaign', row.id, { summary: body.name, before: describeCampaign(row), after: body })
    return ok(describeCampaign(db.prepare('SELECT * FROM campaigns WHERE id = ?').get(row.id) as CampaignRow))
  })

  defineRoute(app, { method: 'delete', path: '/campaigns/:id', tag: 'Campaigns', auth: 'partners.write', summary: 'Delete a campaign and its stats' }, (c, { params }) => {
    const row = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(params.id) as CampaignRow | undefined
    if (!row) throw notFound('Campaign')
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(row.id)
    cache.invalidate('servers')
    audit(c, 'campaign.deleted', 'campaign', row.id, { summary: row.name, before: describeCampaign(row) })
    return ok({ deleted: true })
  })

  defineRoute(app, { method: 'get', path: '/campaigns/:id/stats', tag: 'Campaigns', auth: 'partners.read', summary: 'Impressions, clicks, play attempts, launches per day', query: statsQuery }, (_c, { params, query }) => {
    if (!db.prepare('SELECT 1 FROM campaigns WHERE id = ?').get(params.id)) throw notFound('Campaign')
    return ok(campaignStats([params.id], query.days))
  })
}
