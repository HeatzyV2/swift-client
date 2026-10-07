import type { Hono } from 'hono'
import { z } from 'zod'
import { env } from '../../../env.js'
import { db } from '../../../db.js'
import { audit } from '../../core/audit.js'
import { AppError, badRequest, conflict, notFound } from '../../core/errors.js'
import { actorOf, created, defineRoute, ok, paged, pageQuery, type PEnv } from '../../core/http.js'
import { cache } from '../../core/cache.js'
import { likeEscape } from '../../core/util.js'
import { createAsset, describeAsset, type AssetRow } from './service.js'
import { storage } from './storage.js'

export function registerAssets(app: Hono<PEnv>) {
  defineRoute(app, { method: 'get', path: '/assets', tag: 'Assets', auth: 'assets.read', summary: 'List uploaded assets', query: pageQuery }, (_c, { query }) => {
    const w = query.q ? "WHERE filename LIKE ? ESCAPE '\\' OR alt LIKE ? ESCAPE '\\'" : ''
    const args = query.q ? [`%${likeEscape(query.q)}%`, `%${likeEscape(query.q)}%`] : []
    const total = (db.prepare(`SELECT COUNT(*) AS n FROM assets ${w}`).get(...args) as { n: number }).n
    const rows = db.prepare(`SELECT * FROM assets ${w} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...args, query.limit, (query.page - 1) * query.limit) as AssetRow[]
    return paged(rows.map(describeAsset), total, query.page, query.limit)
  })

  defineRoute(app, { method: 'get', path: '/assets/:id', tag: 'Assets', auth: 'assets.read', summary: 'Asset detail' }, (_c, { params }) => {
    const a = db.prepare('SELECT * FROM assets WHERE id = ?').get(params.id) as AssetRow | undefined
    if (!a) throw notFound('Asset')
    return ok(describeAsset(a))
  })

  // Multipart upload: field "file" (+ optional "alt"). Validated by content, size-capped, deduplicated by SHA-256.
  defineRoute(app, { method: 'post', path: '/assets', tag: 'Assets', auth: 'assets.write', rate: 'upload', summary: 'Upload an image (multipart/form-data, field "file")' }, async (c) => {
    const declared = Number(c.req.header('content-length') ?? 0)
    if (declared > env.assetMaxBytes + 4096) throw new AppError(413, 'PAYLOAD_TOO_LARGE', `File too large (max ${env.assetMaxBytes} bytes)`)
    if (!(c.req.header('content-type') ?? '').toLowerCase().startsWith('multipart/form-data')) throw badRequest('Expected multipart/form-data')
    const form = await c.req.parseBody().catch(() => null)
    const file = form?.file
    if (!(file instanceof File)) throw badRequest('Missing "file" field')
    if (file.size > env.assetMaxBytes) throw new AppError(413, 'PAYLOAD_TOO_LARGE', `File too large (max ${env.assetMaxBytes} bytes)`)
    const alt = typeof form?.alt === 'string' ? form.alt.slice(0, 200) : null
    const row = await createAsset(Buffer.from(await file.arrayBuffer()), file.name || 'upload', alt, actorOf(c).id)
    audit(c, 'asset.uploaded', 'asset', row.id, { summary: row.filename, after: { size: row.size, mime: row.mime } })
    return created(describeAsset(row))
  })

  defineRoute(app, { method: 'patch', path: '/assets/:id', tag: 'Assets', auth: 'assets.write', summary: 'Edit alt text', body: z.object({ alt: z.string().max(200) }) }, (c, { params, body }) => {
    const a = db.prepare('SELECT * FROM assets WHERE id = ?').get(params.id) as AssetRow | undefined
    if (!a) throw notFound('Asset')
    db.prepare('UPDATE assets SET alt = ? WHERE id = ?').run(body.alt, a.id)
    audit(c, 'asset.updated', 'asset', a.id, { before: { alt: a.alt }, after: { alt: body.alt } })
    return ok(describeAsset({ ...a, alt: body.alt }))
  })

  defineRoute(app, { method: 'delete', path: '/assets/:id', tag: 'Assets', auth: 'assets.write', summary: 'Delete an asset that is not referenced anywhere' }, async (c, { params }) => {
    const a = db.prepare('SELECT * FROM assets WHERE id = ?').get(params.id) as AssetRow | undefined
    if (!a) throw notFound('Asset')
    const ref = `%asset:${a.id}%`
    const used = ['home_sections.config', 'home_snapshots.payload', 'news.image', 'servers.icon', 'servers.banner', 'campaigns.creative', 'announcements.body']
      .find((col) => {
        const [t, f] = col.split('.')
        return db.prepare(`SELECT 1 FROM ${t} WHERE ${f} LIKE ? LIMIT 1`).get(ref)
      })
    if (used) throw conflict(`Asset is still used by ${used.split('.')[0]}`)
    db.prepare('DELETE FROM assets WHERE id = ?').run(a.id)
    await storage.delete(a.storage_key)
    cache.invalidate('assets')
    audit(c, 'asset.deleted', 'asset', a.id, { summary: a.filename })
    return ok({ deleted: true })
  })
}

/** Public file serving: /cdn/assets/<aa>/<id>.<ext>. Immutable: keys are content-derived ids. */
export function registerAssetFiles(app: Hono<PEnv>) {
  app.get('/cdn/assets/:shard/:file', async (c) => {
    const { shard, file } = c.req.param()
    if (!/^[A-Za-z0-9_-]{2}$/.test(shard) || !/^[A-Za-z0-9_-]+\.(png|jpg|webp|gif)$/.test(file)) return c.json({ message: 'not found' }, 404)
    const data = await storage.get(`${shard}/${file}`)
    if (!data) return c.json({ message: 'not found' }, 404)
    const mime = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }[file.split('.').pop() as 'png'] ?? 'application/octet-stream'
    return new Response(new Uint8Array(data), {
      headers: { 'Content-Type': mime, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'", 'Access-Control-Allow-Origin': '*' },
    })
  })
}
