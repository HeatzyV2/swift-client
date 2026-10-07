// Launcher release management and update checks. A release is metadata (version, channel, platform, arch,
// download URL, SHA-256, signature): the binary itself lives on the download host.
import type { Hono } from 'hono'
import { z } from 'zod'
import { env } from '../../../env.js'
import { db } from '../../../db.js'
import { audit } from '../../core/audit.js'
import { cache } from '../../core/cache.js'
import { badRequest, conflict, notFound } from '../../core/errors.js'
import { emit, notify } from '../../core/events.js'
import { actorOf, created, defineRoute, ok, paged, pageQuery, type PEnv } from '../../core/http.js'
import { arch, bucket, channel, optionalLocalized, platform, version, type ClientContext } from '../../core/schemas.js'
import { compareVersions, fromJson, newId, nowIso, pickLocale, toJson, type Localized } from '../../core/util.js'

const downloadUrl = z.string().trim().max(600).refine((u) => {
  try {
    const url = new URL(u)
    if (url.protocol !== 'https:' && !(env.appEnv !== 'production' && url.protocol === 'http:')) return false
    return true
  } catch { return false }
}, 'Must be an https URL')

const releaseInput = z.object({
  version, channel, platform, arch,
  url: downloadUrl,
  sha256: z.string().trim().toLowerCase().regex(/^[a-f0-9]{64}$/, 'SHA-256 as 64 hex characters'),
  signature: z.string().trim().max(2000).nullable().optional(),
  size: z.number().int().min(1).max(4_000_000_000).nullable().optional(),
  notes: optionalLocalized(4000),
  mandatory: z.boolean().default(false),
  minimumVersion: version.nullable().optional(),
  rolloutPercent: z.number().int().min(1).max(100).default(100),
}).strict()

type ReleaseRow = {
  id: string, version: string, channel: string, platform: string, arch: string, url: string, sha256: string, signature: string | null,
  size: number | null, notes: string, mandatory: number, minimum_version: string | null, rollout_percent: number, status: string,
  revoke_reason: string | null, published_at: string | null, created_at: string, updated_at: string,
}

export function describeRelease(r: ReleaseRow) {
  return {
    id: r.id, version: r.version, channel: r.channel, platform: r.platform, arch: r.arch, url: r.url, sha256: r.sha256, signature: r.signature,
    size: r.size, notes: fromJson<Localized>(r.notes, {}), mandatory: !!r.mandatory, minimumVersion: r.minimum_version,
    rolloutPercent: r.rollout_percent, status: r.status, revokeReason: r.revoke_reason, publishedAt: r.published_at,
    createdAt: r.created_at, updatedAt: r.updated_at,
  }
}

// Channels inherit from more stable ones: a beta client also sees stable releases, etc.
const CHANNEL_ORDER = ['stable', 'beta', 'canary', 'development']
const eligibleChannels = (ch: string) => CHANNEL_ORDER.slice(0, Math.max(1, CHANNEL_ORDER.indexOf(ch) + 1))

export type UpdateCheck = {
  updateAvailable: boolean, mandatory: boolean, minimumVersion: string | null,
  release: ReturnType<typeof describeRelease> | null,
}

/** Best published, non-revoked release newer than the client's, honouring channel inheritance and staged rollout. */
export function checkUpdate(ctx: ClientContext & { channel: string }, osName: string, archName: string, current: string): UpdateCheck {
  const channels = eligibleChannels(ctx.channel)
  const rows = cache.get(`releases:${osName}:${archName}:${channels.join('')}`, 30_000, ['releases'], () =>
    db.prepare(`SELECT * FROM releases WHERE status = 'published' AND platform = ? AND arch = ? AND channel IN (${channels.map(() => '?').join(',')})`).all(osName, archName, ...channels) as ReleaseRow[])
  const sorted = [...rows].sort((a, b) => compareVersions(b.version, a.version))
  // Floor of the whole channel set: the highest minimumVersion among published releases newer than the client.
  const newer = sorted.filter(r => compareVersions(r.version, current) > 0)
  const forced = newer.find(r => r.minimum_version && compareVersions(current, r.minimum_version) < 0)
  const pick = newer.find(r => r.rollout_percent >= 100 || (ctx.device ? bucket(ctx.device, `release:${r.id}`) < r.rollout_percent : false)) ?? null
  const target = forced ?? pick
  if (!target) return { updateAvailable: false, mandatory: false, minimumVersion: null, release: null }
  return {
    updateAvailable: true,
    mandatory: !!target.mandatory || !!forced,
    minimumVersion: target.minimum_version,
    release: describeRelease(target),
  }
}

/** Tauri updater payload: { version, notes, pub_date, url, signature }. null = 204. */
export function tauriPayload(u: UpdateCheck, locale?: string) {
  if (!u.updateAvailable || !u.release || !u.release.signature) return null
  return { version: u.release.version, notes: pickLocale(u.release.notes, locale), pub_date: u.release.publishedAt, url: u.release.url, signature: u.release.signature }
}

export function registerReleases(app: Hono<PEnv>) {
  defineRoute(app, {
    method: 'get', path: '/releases', tag: 'Releases', auth: 'releases.read', summary: 'List releases',
    query: pageQuery.extend({ channel: channel.optional(), status: z.enum(['draft', 'published', 'revoked']).optional() }),
  }, (_c, { query }) => {
    const where: string[] = []
    const args: unknown[] = []
    if (query.channel) { where.push('channel = ?'); args.push(query.channel) }
    if (query.status) { where.push('status = ?'); args.push(query.status) }
    if (query.q) { where.push('version LIKE ?'); args.push(`${query.q.replace(/[^0-9a-zA-Z.-]/g, '')}%`) }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const total = (db.prepare(`SELECT COUNT(*) AS n FROM releases ${w}`).get(...args) as { n: number }).n
    const rows = db.prepare(`SELECT * FROM releases ${w} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...args, query.limit, (query.page - 1) * query.limit) as ReleaseRow[]
    return paged(rows.map(describeRelease), total, query.page, query.limit)
  })

  defineRoute(app, { method: 'get', path: '/releases/:id', tag: 'Releases', auth: 'releases.read', summary: 'Release detail' }, (_c, { params }) => {
    const r = db.prepare('SELECT * FROM releases WHERE id = ?').get(params.id) as ReleaseRow | undefined
    if (!r) throw notFound('Release')
    return ok(describeRelease(r))
  })

  defineRoute(app, { method: 'post', path: '/releases', tag: 'Releases', auth: 'releases.write', summary: 'Register a release (draft)', body: releaseInput }, (c, { body }) => {
    if (body.minimumVersion && compareVersions(body.minimumVersion, body.version) > 0) throw badRequest('minimumVersion cannot be above the release version')
    if (db.prepare('SELECT 1 FROM releases WHERE version=? AND channel=? AND platform=? AND arch=?').get(body.version, body.channel, body.platform, body.arch)) throw conflict('This version already exists for this channel, platform and architecture')
    const id = newId(12)
    const now = nowIso()
    db.prepare(`INSERT INTO releases (id, version, channel, platform, arch, url, sha256, signature, size, notes, mandatory, minimum_version, rollout_percent, status, created_by, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'draft',?,?,?)`).run(id, body.version, body.channel, body.platform, body.arch, body.url, body.sha256, body.signature ?? null, body.size ?? null, toJson(body.notes), body.mandatory ? 1 : 0, body.minimumVersion ?? null, body.rolloutPercent, actorOf(c).id, now, now)
    audit(c, 'release.created', 'release', id, { summary: `${body.version} ${body.channel} ${body.platform}/${body.arch}`, after: body })
    return created(describeRelease(db.prepare('SELECT * FROM releases WHERE id = ?').get(id) as ReleaseRow))
  })

  defineRoute(app, { method: 'put', path: '/releases/:id', tag: 'Releases', auth: 'releases.write', summary: 'Edit a draft release', body: releaseInput }, (c, { params, body }) => {
    const row = db.prepare('SELECT * FROM releases WHERE id = ?').get(params.id) as ReleaseRow | undefined
    if (!row) throw notFound('Release')
    if (row.status !== 'draft') throw conflict('Only drafts can be edited; publish a new version instead')
    db.prepare(`UPDATE releases SET version=?, channel=?, platform=?, arch=?, url=?, sha256=?, signature=?, size=?, notes=?, mandatory=?, minimum_version=?, rollout_percent=?, updated_at=? WHERE id=?`)
      .run(body.version, body.channel, body.platform, body.arch, body.url, body.sha256, body.signature ?? null, body.size ?? null, toJson(body.notes), body.mandatory ? 1 : 0, body.minimumVersion ?? null, body.rolloutPercent, nowIso(), row.id)
    audit(c, 'release.updated', 'release', row.id, { before: describeRelease(row), after: body })
    return ok(describeRelease(db.prepare('SELECT * FROM releases WHERE id = ?').get(row.id) as ReleaseRow))
  })

  defineRoute(app, { method: 'post', path: '/releases/:id/publish', tag: 'Releases', auth: 'releases.publish', summary: 'Publish a draft release' }, (c, { params }) => {
    const row = db.prepare('SELECT * FROM releases WHERE id = ?').get(params.id) as ReleaseRow | undefined
    if (!row) throw notFound('Release')
    if (row.status === 'published') throw conflict('Already published')
    db.prepare("UPDATE releases SET status='published', published_at=?, revoke_reason=NULL, updated_at=? WHERE id=?").run(nowIso(), nowIso(), row.id)
    cache.invalidate('releases', 'launcher')
    audit(c, 'release.published', 'release', row.id, { summary: `${row.version} ${row.channel}` })
    emit('release.published', { version: row.version, channel: row.channel, platform: row.platform, arch: row.arch, mandatory: !!row.mandatory })
    notify('success', `Release ${row.version} published`, `${row.channel} ${row.platform}/${row.arch}`, '#/releases', 'releases.read')
    return ok(describeRelease(db.prepare('SELECT * FROM releases WHERE id = ?').get(row.id) as ReleaseRow))
  })

  defineRoute(app, {
    method: 'post', path: '/releases/:id/revoke', tag: 'Releases', auth: 'releases.publish',
    summary: 'Roll back: withdraw a release so clients get the previous published version',
    body: z.object({ reason: z.string().trim().min(3).max(300) }),
  }, (c, { params, body }) => {
    const row = db.prepare('SELECT * FROM releases WHERE id = ?').get(params.id) as ReleaseRow | undefined
    if (!row) throw notFound('Release')
    if (row.status !== 'published') throw conflict('Only published releases can be revoked')
    db.prepare("UPDATE releases SET status='revoked', revoke_reason=?, updated_at=? WHERE id=?").run(body.reason, nowIso(), row.id)
    cache.invalidate('releases', 'launcher')
    audit(c, 'release.revoked', 'release', row.id, { summary: `${row.version}: ${body.reason}` })
    emit('release.revoked', { version: row.version, channel: row.channel, reason: body.reason })
    notify('warning', `Release ${row.version} revoked`, body.reason, '#/releases', 'releases.read')
    return ok(describeRelease(db.prepare('SELECT * FROM releases WHERE id = ?').get(row.id) as ReleaseRow))
  })

  defineRoute(app, { method: 'delete', path: '/releases/:id', tag: 'Releases', auth: 'releases.write', summary: 'Delete a draft release' }, (c, { params }) => {
    const row = db.prepare('SELECT * FROM releases WHERE id = ?').get(params.id) as ReleaseRow | undefined
    if (!row) throw notFound('Release')
    if (row.status === 'published') throw conflict('Revoke a published release instead of deleting it')
    db.prepare('DELETE FROM releases WHERE id = ?').run(row.id)
    audit(c, 'release.deleted', 'release', row.id, { summary: row.version, before: describeRelease(row) })
    return ok({ deleted: true })
  })
}
