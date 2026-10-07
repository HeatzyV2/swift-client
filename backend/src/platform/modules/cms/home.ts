// Home builder: draft sections (editable), published snapshots (what the launcher sees), history and rollback.
// Sections are DATA only (text, image refs, links, a few known kinds): nothing the launcher could execute.
import type { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../../../db.js'
import { audit } from '../../core/audit.js'
import { cache } from '../../core/cache.js'
import { badRequest, notFound } from '../../core/errors.js'
import { emit } from '../../core/events.js'
import { actorOf, created, defineRoute, ok, type PEnv } from '../../core/http.js'
import { imageRef, isoDate, localized, optionalLocalized, safeUrl, targetingSchema, type Targeting } from '../../core/schemas.js'
import { fromJson, newId, nowIso, sha256, toJson, type Localized } from '../../core/util.js'

const cta = z.object({ label: localized(60), url: safeUrl }).strict()
const common = { title: optionalLocalized(120) }

export const sectionInput = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('hero'), ...common, config: z.object({ image: imageRef.optional(), subtitle: optionalLocalized(240), badge: optionalLocalized(30), cta: cta.optional() }).strict() }),
  z.object({ kind: z.literal('news'), ...common, config: z.object({ limit: z.number().int().min(1).max(10).default(4) }).strict() }),
  z.object({ kind: z.literal('servers'), ...common, config: z.object({ mode: z.enum(['featured', 'all']).default('featured'), limit: z.number().int().min(1).max(20).default(6) }).strict() }),
  z.object({ kind: z.literal('partners'), ...common, config: z.object({ limit: z.number().int().min(1).max(6).default(3) }).strict() }),
  z.object({ kind: z.literal('banner'), ...common, config: z.object({ image: imageRef, url: safeUrl.optional(), alt: optionalLocalized(120) }).strict() }),
  z.object({ kind: z.literal('links'), ...common, config: z.object({ items: z.array(z.object({ label: localized(40), url: safeUrl, icon: z.string().regex(/^[a-z0-9-]{1,30}$/).optional() }).strict()).min(1).max(12) }).strict() }),
  z.object({ kind: z.literal('text'), ...common, config: z.object({ body: localized(1500) }).strict() }),
]).and(z.object({
  enabled: z.boolean().default(true),
  startsAt: isoDate.nullable().optional(),
  endsAt: isoDate.nullable().optional(),
  targeting: targetingSchema.default({}),
}))
export type SectionInput = z.output<typeof sectionInput>

type SectionRow = {
  id: string, kind: string, title: string, config: string, position: number, enabled: number,
  starts_at: string | null, ends_at: string | null, targeting: string, created_at: string, updated_at: string,
}

export type HomeSection = {
  id: string, kind: string, title: Localized, config: Record<string, unknown>, position: number, enabled: boolean,
  startsAt: string | null, endsAt: string | null, targeting: Targeting, updatedAt: string,
}

const toSection = (r: SectionRow): HomeSection => ({
  id: r.id, kind: r.kind, title: fromJson(r.title, {}), config: fromJson(r.config, {}), position: r.position, enabled: !!r.enabled,
  startsAt: r.starts_at, endsAt: r.ends_at, targeting: fromJson(r.targeting, {}), updatedAt: r.updated_at,
})

export function draftSections(): HomeSection[] {
  return (db.prepare('SELECT * FROM home_sections ORDER BY position, created_at').all() as SectionRow[]).map(toSection)
}

export type Snapshot = { id: number, createdAt: string, createdBy: string | null, note: string | null, active: boolean }

export function activeSnapshot(): { id: number, sections: HomeSection[] } | null {
  return cache.get('home:active', 30_000, ['home'], () => {
    const r = db.prepare('SELECT id, payload FROM home_snapshots WHERE active = 1').get() as { id: number, payload: string } | undefined
    return r ? { id: r.id, sections: fromJson<HomeSection[]>(r.payload, []) } : null
  })
}

const digest = (sections: HomeSection[]) => sha256(JSON.stringify(sections.map(({ updatedAt: _u, ...s }) => s)))

function writeSection(id: string, input: SectionInput, position: number, existing?: SectionRow) {
  const now = nowIso()
  if (existing) {
    db.prepare('UPDATE home_sections SET kind=?, title=?, config=?, enabled=?, starts_at=?, ends_at=?, targeting=?, updated_at=? WHERE id=?')
      .run(input.kind, toJson(input.title), toJson(input.config), input.enabled ? 1 : 0, input.startsAt ?? null, input.endsAt ?? null, toJson(input.targeting), now, id)
  } else {
    db.prepare('INSERT INTO home_sections (id, kind, title, config, position, enabled, starts_at, ends_at, targeting, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .run(id, input.kind, toJson(input.title), toJson(input.config), position, input.enabled ? 1 : 0, input.startsAt ?? null, input.endsAt ?? null, toJson(input.targeting), now, now)
  }
  const size = (db.prepare('SELECT length(config) AS n FROM home_sections WHERE id = ?').get(id) as { n: number }).n
  if (size > 20_000) throw badRequest('Section configuration is too large')
}

export function registerHome(app: Hono<PEnv>) {
  defineRoute(app, { method: 'get', path: '/home/sections', tag: 'Home', auth: 'home.read', summary: 'Draft sections, with publication state' }, () => {
    const draft = draftSections()
    const active = db.prepare('SELECT id, payload FROM home_snapshots WHERE active = 1').get() as { id: number, payload: string } | undefined
    const live = active ? fromJson<HomeSection[]>(active.payload, []) : []
    return ok({ sections: draft, publishedSnapshotId: active?.id ?? null, dirty: digest(draft) !== digest(live) })
  })

  defineRoute(app, { method: 'post', path: '/home/sections', tag: 'Home', auth: 'home.write', summary: 'Create a section (draft)', body: sectionInput }, (c, { body }) => {
    const id = newId(12)
    const pos = (db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM home_sections').get() as { p: number }).p
    writeSection(id, body, pos)
    audit(c, 'home.section_created', 'home_section', id, { summary: body.kind, after: body })
    return created(draftSections().find(s => s.id === id))
  })

  defineRoute(app, { method: 'put', path: '/home/sections/order', tag: 'Home', auth: 'home.write', summary: 'Reorder sections (full list of ids)', body: z.object({ ids: z.array(z.string().max(40)).max(100) }) }, (c, { body }) => {
    const existing = (db.prepare('SELECT id FROM home_sections').all() as { id: string }[]).map(r => r.id)
    if (body.ids.length !== existing.length || !existing.every(id => body.ids.includes(id))) throw badRequest('ids must list every section exactly once')
    const up = db.prepare('UPDATE home_sections SET position = ?, updated_at = ? WHERE id = ?')
    db.transaction(() => body.ids.forEach((id, i) => up.run(i, nowIso(), id)))()
    audit(c, 'home.reordered', 'home_section', null, { after: body.ids })
    return ok(draftSections())
  })

  defineRoute(app, { method: 'put', path: '/home/sections/:id', tag: 'Home', auth: 'home.write', summary: 'Update a section (draft)', body: sectionInput }, (c, { params, body }) => {
    const row = db.prepare('SELECT * FROM home_sections WHERE id = ?').get(params.id) as SectionRow | undefined
    if (!row) throw notFound('Section')
    writeSection(row.id, body, row.position, row)
    audit(c, 'home.section_updated', 'home_section', row.id, { summary: body.kind, before: toSection(row), after: body })
    return ok(draftSections().find(s => s.id === row.id))
  })

  defineRoute(app, { method: 'delete', path: '/home/sections/:id', tag: 'Home', auth: 'home.write', summary: 'Delete a section (draft)' }, (c, { params }) => {
    const row = db.prepare('SELECT * FROM home_sections WHERE id = ?').get(params.id) as SectionRow | undefined
    if (!row) throw notFound('Section')
    db.prepare('DELETE FROM home_sections WHERE id = ?').run(row.id)
    audit(c, 'home.section_deleted', 'home_section', row.id, { before: toSection(row) })
    return ok({ deleted: true })
  })

  defineRoute(app, {
    method: 'post', path: '/home/publish', tag: 'Home', auth: 'home.publish', summary: 'Publish the draft as a new snapshot',
    body: z.object({ note: z.string().trim().max(200).optional() }),
  }, (c, { body }) => {
    const draft = draftSections()
    const actor = actorOf(c)
    const id = db.transaction(() => {
      db.prepare('UPDATE home_snapshots SET active = 0 WHERE active = 1').run()
      return Number(db.prepare('INSERT INTO home_snapshots (created_at, created_by, note, payload, active) VALUES (?,?,?,?,1)')
        .run(nowIso(), actor.username, body.note ?? null, toJson(draft)).lastInsertRowid)
    })()
    cache.invalidate('home', 'launcher')
    audit(c, 'home.published', 'home_snapshot', String(id), { summary: body.note ?? `${draft.length} sections` })
    emit('home.published', { snapshotId: id, sections: draft.length, by: actor.username })
    return created({ snapshotId: id, sections: draft.length })
  })

  defineRoute(app, { method: 'get', path: '/home/snapshots', tag: 'Home', auth: 'home.read', summary: 'Publication history' }, () => {
    const rows = db.prepare('SELECT id, created_at, created_by, note, active, payload FROM home_snapshots ORDER BY id DESC LIMIT 50').all() as
      { id: number, created_at: string, created_by: string | null, note: string | null, active: number, payload: string }[]
    return ok(rows.map(r => ({ id: r.id, createdAt: r.created_at, createdBy: r.created_by, note: r.note, active: !!r.active, sections: fromJson<unknown[]>(r.payload, []).length })))
  })

  defineRoute(app, {
    method: 'post', path: '/home/snapshots/:id/rollback', tag: 'Home', auth: 'home.publish', summary: 'Make a previous snapshot live again (and restore it as the draft)',
    body: z.object({ restoreDraft: z.boolean().default(true) }),
  }, (c, { params, body }) => {
    const snap = db.prepare('SELECT id, payload FROM home_snapshots WHERE id = ?').get(Number(params.id)) as { id: number, payload: string } | undefined
    if (!snap) throw notFound('Snapshot')
    const sections = fromJson<HomeSection[]>(snap.payload, [])
    db.transaction(() => {
      db.prepare('UPDATE home_snapshots SET active = CASE WHEN id = ? THEN 1 ELSE 0 END').run(snap.id)
      if (body.restoreDraft) {
        db.prepare('DELETE FROM home_sections').run()
        for (const s of sections) {
          db.prepare('INSERT INTO home_sections (id, kind, title, config, position, enabled, starts_at, ends_at, targeting, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
            .run(s.id, s.kind, toJson(s.title), toJson(s.config), s.position, s.enabled ? 1 : 0, s.startsAt, s.endsAt, toJson(s.targeting), nowIso(), nowIso())
        }
      }
    })()
    cache.invalidate('home', 'launcher')
    audit(c, 'home.rolled_back', 'home_snapshot', String(snap.id))
    emit('home.rolled_back', { snapshotId: snap.id })
    return ok({ snapshotId: snap.id, sections: sections.length })
  })
}
