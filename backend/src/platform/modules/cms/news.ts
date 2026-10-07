// News, changelog and announcements. Scheduled content goes live by itself: reads treat a "scheduled" item
// whose publish_at has passed as published, and promoteScheduled() (run every 30 s) makes it official.
import type { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../../../db.js'
import { audit } from '../../core/audit.js'
import { cache } from '../../core/cache.js'
import { badRequest, conflict, forbidden, notFound } from '../../core/errors.js'
import { emit, notify } from '../../core/events.js'
import { actorOf, created, defineRoute, ok, paged, pageQuery, type PEnv } from '../../core/http.js'
import { imageRef, inWindow, isoDate, localized, matches, optionalLocalized, safeUrl, slug, targetingSchema, type ClientContext, type Targeting } from '../../core/schemas.js'
import { fromJson, likeEscape, newId, nowIso, toJson, type Localized } from '../../core/util.js'
import { resolveImage } from '../assets/service.js'

// ---- News ------------------------------------------------------------------------------------------

const NEWS_STATUS = ['draft', 'scheduled', 'published', 'archived'] as const

const newsBase = z.object({
  slug: slug.optional(),
  title: localized(160),
  summary: localized(400),
  body: optionalLocalized(8000),
  image: imageRef.nullable().optional(),
  url: safeUrl.nullable().optional(),
  direct: z.boolean().default(false),
  category: z.string().trim().max(30).nullable().optional(),
  pinned: z.boolean().default(false),
})
const newsInput = newsBase.extend({ status: z.enum(NEWS_STATUS).default('draft'), publishAt: isoDate.nullable().optional() })

type NewsRow = {
  id: string, slug: string, status: string, title: string, summary: string, body: string, image: string | null, url: string | null,
  direct: number, category: string | null, pinned: number, publish_at: string | null, published_at: string | null, created_at: string, updated_at: string,
}

const effectiveStatus = (r: NewsRow) => (r.status === 'scheduled' && r.publish_at && r.publish_at <= nowIso() ? 'published' : r.status)

export function describeNews(r: NewsRow) {
  return {
    id: r.id, slug: r.slug, status: r.status, effectiveStatus: effectiveStatus(r),
    title: fromJson<Localized>(r.title, {}), summary: fromJson<Localized>(r.summary, {}), body: fromJson<Localized>(r.body, {}),
    image: r.image, imageUrl: resolveImage(r.image), url: r.url, direct: !!r.direct, category: r.category, pinned: !!r.pinned,
    publishAt: r.publish_at, publishedAt: r.published_at, createdAt: r.created_at, updatedAt: r.updated_at,
  }
}

/** News visible to launchers right now. */
export function publishedNews(limit = 20): NewsRow[] {
  return cache.get(`news:published:${limit}`, 30_000, ['news'], () =>
    db.prepare(`SELECT * FROM news WHERE (status = 'published' OR (status = 'scheduled' AND publish_at <= ?))
      ORDER BY pinned DESC, COALESCE(published_at, publish_at, created_at) DESC LIMIT ?`).all(nowIso(), limit) as NewsRow[])
}

export function publishedChangelog(limit = 20) {
  return cache.get(`changelog:${limit}`, 30_000, ['news'], () =>
    (db.prepare("SELECT * FROM changelog WHERE status = 'published' ORDER BY date DESC, created_at DESC LIMIT ?").all(limit) as { id: string, version: string, date: string, items: string }[])
      .map(r => ({ id: r.id, version: r.version, date: r.date, items: fromJson<Localized[]>(r.items, []) })))
}

function uniqueSlug(base: string, exceptId?: string): string {
  let s = base || 'news'
  for (let i = 2; db.prepare('SELECT 1 FROM news WHERE slug = ? AND id != ?').get(s, exceptId ?? '') ; i++) s = `${base}-${i}`
  return s
}

const slugFrom = (t: Localized) => (t.en ?? t.fr ?? Object.values(t)[0] ?? 'news').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)

function canSetStatus(c: Parameters<typeof actorOf>[0], status: string) {
  if ((status === 'published' || status === 'scheduled') && !actorOf(c).permissions.has('news.publish')) throw forbidden('Publishing requires news.publish')
}

export function promoteScheduled(): number {
  const due = db.prepare("SELECT * FROM news WHERE status = 'scheduled' AND publish_at <= ?").all(nowIso()) as NewsRow[]
  for (const n of due) {
    db.prepare("UPDATE news SET status = 'published', published_at = ?, updated_at = ? WHERE id = ?").run(n.publish_at, nowIso(), n.id)
    notify('success', 'Scheduled news published', fromJson<Localized>(n.title, {}).en ?? n.slug, '#/news', 'news.read')
    emit('news.published', { id: n.id, slug: n.slug, title: fromJson<Localized>(n.title, {}), url: n.url })
  }
  if (due.length) cache.invalidate('news')
  return due.length
}

export function registerNews(app: Hono<PEnv>) {
  defineRoute(app, {
    method: 'get', path: '/news', tag: 'News', auth: 'news.read', summary: 'List news',
    query: pageQuery.extend({ status: z.enum(NEWS_STATUS).optional() }),
  }, (_c, { query }) => {
    const where: string[] = []
    const args: unknown[] = []
    if (query.status) { where.push('status = ?'); args.push(query.status) }
    if (query.q) { where.push("(title LIKE ? ESCAPE '\\' OR slug LIKE ? ESCAPE '\\')"); const p = `%${likeEscape(query.q)}%`; args.push(p, p) }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const total = (db.prepare(`SELECT COUNT(*) AS n FROM news ${w}`).get(...args) as { n: number }).n
    const rows = db.prepare(`SELECT * FROM news ${w} ORDER BY updated_at DESC LIMIT ? OFFSET ?`).all(...args, query.limit, (query.page - 1) * query.limit) as NewsRow[]
    return paged(rows.map(describeNews), total, query.page, query.limit)
  })

  defineRoute(app, { method: 'get', path: '/news/:id', tag: 'News', auth: 'news.read', summary: 'News detail' }, (_c, { params }) => {
    const r = db.prepare('SELECT * FROM news WHERE id = ?').get(params.id) as NewsRow | undefined
    if (!r) throw notFound('News')
    return ok(describeNews(r))
  })

  defineRoute(app, { method: 'post', path: '/news', tag: 'News', auth: 'news.write', summary: 'Create a news item', body: newsInput }, (c, { body }) => {
    canSetStatus(c, body.status)
    if (body.status === 'scheduled' && !body.publishAt) throw badRequest('publishAt is required for scheduled news')
    const id = newId(12)
    const now = nowIso()
    const publishedAt = body.status === 'published' ? (body.publishAt ?? now) : null
    db.prepare(`INSERT INTO news (id, slug, status, title, summary, body, image, url, direct, category, pinned, publish_at, published_at, created_by, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      id, uniqueSlug(body.slug ?? slugFrom(body.title)), body.status, toJson(body.title), toJson(body.summary), toJson(body.body), body.image ?? null, body.url ?? null,
      body.direct ? 1 : 0, body.category ?? null, body.pinned ? 1 : 0, body.publishAt ?? null, publishedAt, actorOf(c).id, now, now)
    cache.invalidate('news')
    audit(c, 'news.created', 'news', id, { summary: body.title.en ?? body.title.fr, after: body })
    if (body.status === 'published') emit('news.published', { id, title: body.title, url: body.url })
    return created(describeNews(db.prepare('SELECT * FROM news WHERE id = ?').get(id) as NewsRow))
  })

  defineRoute(app, { method: 'put', path: '/news/:id', tag: 'News', auth: 'news.write', summary: 'Update a news item', body: newsInput }, (c, { params, body }) => {
    const row = db.prepare('SELECT * FROM news WHERE id = ?').get(params.id) as NewsRow | undefined
    if (!row) throw notFound('News')
    canSetStatus(c, body.status)
    if (row.status === 'published' && !actorOf(c).permissions.has('news.publish')) throw forbidden('Editing published news requires news.publish')
    if (body.status === 'scheduled' && !body.publishAt) throw badRequest('publishAt is required for scheduled news')
    const publishedAt = body.status === 'published' ? (row.published_at ?? body.publishAt ?? nowIso()) : (body.status === 'archived' ? row.published_at : null)
    db.prepare(`UPDATE news SET slug=?, status=?, title=?, summary=?, body=?, image=?, url=?, direct=?, category=?, pinned=?, publish_at=?, published_at=?, updated_at=? WHERE id=?`).run(
      uniqueSlug(body.slug ?? row.slug, row.id), body.status, toJson(body.title), toJson(body.summary), toJson(body.body), body.image ?? null, body.url ?? null,
      body.direct ? 1 : 0, body.category ?? null, body.pinned ? 1 : 0, body.publishAt ?? null, publishedAt, nowIso(), row.id)
    cache.invalidate('news')
    audit(c, 'news.updated', 'news', row.id, { summary: body.title.en ?? body.title.fr, before: describeNews(row), after: body })
    if (body.status === 'published' && row.status !== 'published') emit('news.published', { id: row.id, title: body.title, url: body.url })
    return ok(describeNews(db.prepare('SELECT * FROM news WHERE id = ?').get(row.id) as NewsRow))
  })

  defineRoute(app, {
    method: 'post', path: '/news/:id/status', tag: 'News', auth: 'news.write', summary: 'Change status: draft, scheduled (with publishAt), published, archived',
    body: z.object({ status: z.enum(NEWS_STATUS), publishAt: isoDate.nullable().optional() }),
  }, (c, { params, body }) => {
    const row = db.prepare('SELECT * FROM news WHERE id = ?').get(params.id) as NewsRow | undefined
    if (!row) throw notFound('News')
    canSetStatus(c, body.status)
    if (row.status === 'published' && !actorOf(c).permissions.has('news.publish')) throw forbidden('Changing published news requires news.publish')
    if (body.status === 'scheduled' && !body.publishAt) throw badRequest('publishAt is required for scheduled news')
    const publishedAt = body.status === 'published' ? (row.published_at ?? nowIso()) : (body.status === 'archived' ? row.published_at : null)
    db.prepare('UPDATE news SET status = ?, publish_at = ?, published_at = ?, updated_at = ? WHERE id = ?').run(body.status, body.publishAt ?? (body.status === 'published' ? row.publish_at : null), publishedAt, nowIso(), row.id)
    cache.invalidate('news')
    audit(c, `news.${body.status}`, 'news', row.id, { summary: row.slug, before: { status: row.status }, after: { status: body.status, publishAt: body.publishAt } })
    if (body.status === 'published' && row.status !== 'published') emit('news.published', { id: row.id, title: fromJson(row.title, {}), url: row.url })
    return ok(describeNews(db.prepare('SELECT * FROM news WHERE id = ?').get(row.id) as NewsRow))
  })

  defineRoute(app, { method: 'delete', path: '/news/:id', tag: 'News', auth: 'news.write', summary: 'Delete a news item (published ones must be archived first)' }, (c, { params }) => {
    const row = db.prepare('SELECT * FROM news WHERE id = ?').get(params.id) as NewsRow | undefined
    if (!row) throw notFound('News')
    if (effectiveStatus(row) === 'published') throw conflict('Archive published news before deleting it')
    db.prepare('DELETE FROM news WHERE id = ?').run(row.id)
    cache.invalidate('news')
    audit(c, 'news.deleted', 'news', row.id, { summary: row.slug, before: describeNews(row) })
    return ok({ deleted: true })
  })

  // ---- Changelog -------------------------------------------------------------------------------------

  const changelogInput = z.object({
    version: z.string().trim().min(1).max(32),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    items: z.array(localized(300)).min(1).max(40),
    status: z.enum(['draft', 'published']).default('published'),
  })
  type ClRow = { id: string, version: string, date: string, items: string, status: string }
  const cl = (r: ClRow) => ({ id: r.id, version: r.version, date: r.date, items: fromJson<Localized[]>(r.items, []), status: r.status })

  defineRoute(app, { method: 'get', path: '/changelog', tag: 'News', auth: 'news.read', summary: 'List changelog entries' }, () =>
    ok((db.prepare('SELECT * FROM changelog ORDER BY date DESC, created_at DESC LIMIT 200').all() as ClRow[]).map(cl)))

  defineRoute(app, { method: 'post', path: '/changelog', tag: 'News', auth: 'news.publish', summary: 'Add a changelog entry', body: changelogInput }, (c, { body }) => {
    const id = newId(12)
    db.prepare('INSERT INTO changelog (id, version, date, items, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?)').run(id, body.version, body.date, toJson(body.items), body.status, nowIso(), nowIso())
    cache.invalidate('news')
    audit(c, 'changelog.created', 'changelog', id, { summary: body.version, after: body })
    return created(cl(db.prepare('SELECT * FROM changelog WHERE id = ?').get(id) as ClRow))
  })

  defineRoute(app, { method: 'put', path: '/changelog/:id', tag: 'News', auth: 'news.publish', summary: 'Update a changelog entry', body: changelogInput }, (c, { params, body }) => {
    const row = db.prepare('SELECT * FROM changelog WHERE id = ?').get(params.id) as ClRow | undefined
    if (!row) throw notFound('Changelog entry')
    db.prepare('UPDATE changelog SET version=?, date=?, items=?, status=?, updated_at=? WHERE id=?').run(body.version, body.date, toJson(body.items), body.status, nowIso(), row.id)
    cache.invalidate('news')
    audit(c, 'changelog.updated', 'changelog', row.id, { summary: body.version, before: cl(row), after: body })
    return ok(cl(db.prepare('SELECT * FROM changelog WHERE id = ?').get(row.id) as ClRow))
  })

  defineRoute(app, { method: 'delete', path: '/changelog/:id', tag: 'News', auth: 'news.publish', summary: 'Delete a changelog entry' }, (c, { params }) => {
    const row = db.prepare('SELECT * FROM changelog WHERE id = ?').get(params.id) as ClRow | undefined
    if (!row) throw notFound('Changelog entry')
    db.prepare('DELETE FROM changelog WHERE id = ?').run(row.id)
    cache.invalidate('news')
    audit(c, 'changelog.deleted', 'changelog', row.id, { summary: row.version, before: cl(row) })
    return ok({ deleted: true })
  })
}

// ---- Announcements ---------------------------------------------------------------------------------

const announcementInput = z.object({
  type: z.enum(['info', 'success', 'warning', 'critical']).default('info'),
  title: localized(120),
  body: optionalLocalized(500),
  linkUrl: safeUrl.nullable().optional(),
  dismissible: z.boolean().default(true),
  enabled: z.boolean().default(true),
  startsAt: isoDate.nullable().optional(),
  endsAt: isoDate.nullable().optional(),
  targeting: targetingSchema.default({}),
})

type AnnRow = {
  id: string, type: string, title: string, body: string, link_url: string | null, dismissible: number, enabled: number,
  starts_at: string | null, ends_at: string | null, targeting: string, created_at: string, updated_at: string,
}

export function describeAnnouncement(r: AnnRow) {
  return {
    id: r.id, type: r.type, title: fromJson<Localized>(r.title, {}), body: fromJson<Localized>(r.body, {}), linkUrl: r.link_url,
    dismissible: !!r.dismissible, enabled: !!r.enabled, startsAt: r.starts_at, endsAt: r.ends_at,
    targeting: fromJson<Targeting>(r.targeting, {}), createdAt: r.created_at, updatedAt: r.updated_at,
  }
}

/**
 * Legacy /api/news contract of the launcher: { news: [...], changelog: [...] } with full localized maps.
 * Returns null while the platform has nothing published, so the old news.json (or the bundled content) still works.
 */
export function legacyNews() {
  const news = publishedNews(20)
  const changelog = publishedChangelog(20)
  if (!news.length && !changelog.length) return null
  return {
    news: news.map((r) => {
      const n = describeNews(r)
      return {
        id: n.id, date: (n.publishedAt ?? n.publishAt ?? n.createdAt).slice(0, 10), image: n.imageUrl ?? '',
        title: n.title, summary: n.summary, body: Object.keys(n.body).length ? n.body : { en: '' },
        ...(n.url ? { url: n.url } : {}), ...(n.direct ? { direct: true } : {}),
      }
    }),
    changelog: changelog.map(e => ({ version: e.version, date: e.date, items: e.items })),
  }
}

const SEVERITY: Record<string, number> ={ critical: 0, warning: 1, success: 2, info: 3 }

export function activeAnnouncements(ctx: ClientContext) {
  const rows = cache.get('announcements:enabled', 30_000, ['announcements'], () =>
    db.prepare('SELECT * FROM announcements WHERE enabled = 1').all() as AnnRow[])
  return rows.map(describeAnnouncement)
    .filter(a => inWindow(a.startsAt, a.endsAt) && matches(a.targeting, ctx, a.id))
    .sort((a, b) => SEVERITY[a.type] - SEVERITY[b.type])
}

export function registerAnnouncements(app: Hono<PEnv>) {
  defineRoute(app, { method: 'get', path: '/announcements', tag: 'Announcements', auth: 'announcements.read', summary: 'List announcements' }, () =>
    ok((db.prepare('SELECT * FROM announcements ORDER BY created_at DESC LIMIT 200').all() as AnnRow[]).map(describeAnnouncement)))

  defineRoute(app, { method: 'post', path: '/announcements', tag: 'Announcements', auth: 'announcements.write', summary: 'Create an announcement', body: announcementInput }, (c, { body }) => {
    const id = newId(12)
    const now = nowIso()
    db.prepare(`INSERT INTO announcements (id, type, title, body, link_url, dismissible, enabled, starts_at, ends_at, targeting, created_by, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, body.type, toJson(body.title), toJson(body.body), body.linkUrl ?? null, body.dismissible ? 1 : 0, body.enabled ? 1 : 0, body.startsAt ?? null, body.endsAt ?? null, toJson(body.targeting), actorOf(c).id, now, now)
    cache.invalidate('announcements', 'launcher')
    audit(c, 'announcement.created', 'announcement', id, { summary: body.title.en ?? body.title.fr, after: body })
    if (body.enabled) emit('announcement.created', { id, type: body.type, title: body.title })
    return created(describeAnnouncement(db.prepare('SELECT * FROM announcements WHERE id = ?').get(id) as AnnRow))
  })

  defineRoute(app, { method: 'put', path: '/announcements/:id', tag: 'Announcements', auth: 'announcements.write', summary: 'Update an announcement', body: announcementInput }, (c, { params, body }) => {
    const row = db.prepare('SELECT * FROM announcements WHERE id = ?').get(params.id) as AnnRow | undefined
    if (!row) throw notFound('Announcement')
    db.prepare('UPDATE announcements SET type=?, title=?, body=?, link_url=?, dismissible=?, enabled=?, starts_at=?, ends_at=?, targeting=?, updated_at=? WHERE id=?')
      .run(body.type, toJson(body.title), toJson(body.body), body.linkUrl ?? null, body.dismissible ? 1 : 0, body.enabled ? 1 : 0, body.startsAt ?? null, body.endsAt ?? null, toJson(body.targeting), nowIso(), row.id)
    cache.invalidate('announcements', 'launcher')
    audit(c, 'announcement.updated', 'announcement', row.id, { summary: body.title.en ?? body.title.fr, before: describeAnnouncement(row), after: body })
    return ok(describeAnnouncement(db.prepare('SELECT * FROM announcements WHERE id = ?').get(row.id) as AnnRow))
  })

  defineRoute(app, { method: 'delete', path: '/announcements/:id', tag: 'Announcements', auth: 'announcements.write', summary: 'Delete an announcement' }, (c, { params }) => {
    const row = db.prepare('SELECT * FROM announcements WHERE id = ?').get(params.id) as AnnRow | undefined
    if (!row) throw notFound('Announcement')
    db.prepare('DELETE FROM announcements WHERE id = ?').run(row.id)
    cache.invalidate('announcements', 'launcher')
    audit(c, 'announcement.deleted', 'announcement', row.id, { before: describeAnnouncement(row) })
    return ok({ deleted: true })
  })
}
