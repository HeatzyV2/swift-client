import { createWriteStream, existsSync, mkdirSync, renameSync, unlinkSync, statSync, createReadStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { resolve } from 'node:path'
import { Hono } from 'hono'
import { customAlphabet } from 'nanoid'
import { requireAuth, optionalAuth, type AuthVariables } from '../auth.js'
import { db } from '../db.js'
import { env, shareRedeemUrl } from '../env.js'

const codeAlphabet = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6)

type ShareRow = {
  code: string
  owner_id: string
  revision: number
  name: string
  mc: string
  loader: string
  mods: number
  instance_id: string | null
  size: number | null
  path: string | null
  upload_token: string | null
  status: string
  created_at: string
  expires_at: string
}

function sharePath(code: string): string {
  return resolve(env.dataDir, 'shares', `${code}.zip`)
}

function pendingPath(token: string): string {
  return resolve(env.dataDir, 'uploads', `${token}.zip`)
}

function newCode(): string {
  for (let i = 0; i < 20; i++) {
    const code = codeAlphabet()
    const exists = db.prepare('SELECT 1 FROM shares WHERE code = ?').get(code)
    if (!exists) return code
  }
  throw new Error('could not allocate share code')
}

export const shareRoutes = new Hono<{ Variables: AuthVariables }>()

shareRoutes.post('/upload-url', requireAuth, async (c) => {
  const user = c.get('user')
  const body = await c.req.json().catch(() => null) as {
    size?: number
    name?: string
    mc?: string
    loader?: string
    mods?: number
    instance?: string
  } | null

  const size = Number(body?.size ?? 0)
  const name = (body?.name ?? 'Instance').trim() || 'Instance'
  const mc = (body?.mc ?? '').trim()
  const loader = (body?.loader ?? 'vanilla').trim() || 'vanilla'
  const mods = Number(body?.mods ?? 0)
  const instance = body?.instance?.trim() ?? null

  if (!mc || size <= 0 || size > 2 * 1024 * 1024 * 1024) {
    return c.json({ message: 'invalid pack metadata' }, 400)
  }

  const code = newCode()
  const upload_token = codeAlphabet() + codeAlphabet()
  const created_at = new Date()
  const expires_at = new Date(created_at.getTime() + env.shareTtlDays * 86_400_000)

  db.prepare(`
    INSERT INTO shares (code, owner_id, revision, name, mc, loader, mods, instance_id, size, upload_token, status, created_at, expires_at)
    VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(
    code,
    user.id,
    name,
    mc,
    loader,
    mods,
    instance,
    size,
    upload_token,
    created_at.toISOString(),
    expires_at.toISOString(),
  )

  return c.json({
    code,
    revision: 1,
    url: shareRedeemUrl(code),
    uploadUrl: `${env.publicUrl}/api/share/upload/${upload_token}`,
  })
})

shareRoutes.put('/upload/:token', async (c) => {
  const token = c.req.param('token')
  const row = db.prepare('SELECT * FROM shares WHERE upload_token = ?').get(token) as ShareRow | undefined
  if (!row || row.status === 'expired') {
    return c.json({ message: 'upload not found' }, 404)
  }
  if (row.status === 'ready') {
    return c.json({ message: 'already uploaded' }, 409)
  }

  mkdirSync(resolve(env.dataDir, 'uploads'), { recursive: true })
  const dest = pendingPath(token)
  const body = c.req.raw.body
  if (!body) return c.json({ message: 'empty body' }, 400)

  const nodeStream = Readable.fromWeb(body as import('node:stream/web').ReadableStream)
  await pipeline(nodeStream, createWriteStream(dest))

  const st = statSync(dest)
  db.prepare('UPDATE shares SET path = ?, size = ? WHERE code = ?').run(dest, st.size, row.code)
  return c.body(null, 204)
})

shareRoutes.post('/:code/complete', requireAuth, async (c) => {
  const user = c.get('user')
  const code = (c.req.param('code') ?? '').toUpperCase()
  const body = await c.req.json().catch(() => null) as { size?: number } | null
  const row = db.prepare('SELECT * FROM shares WHERE code = ?').get(code) as ShareRow | undefined
  if (!row || row.owner_id !== user.id) {
    return c.json({ message: 'share not found' }, 404)
  }
  if (!row.path || !existsSync(row.path)) {
    return c.json({ message: 'pack was not uploaded' }, 400)
  }

  const final = sharePath(code)
  mkdirSync(resolve(env.dataDir, 'shares'), { recursive: true })
  if (row.path !== final) {
    renameSync(row.path, final)
  }
  const size = body?.size ?? statSync(final).size
  const expires = Math.floor(new Date(row.expires_at).getTime() / 1000)

  db.prepare(`
    UPDATE shares SET path = ?, size = ?, status = 'ready', upload_token = NULL WHERE code = ?
  `).run(final, size, code)

  return c.json({
    revision: row.revision,
    expires,
    pushed: false,
  })
})

shareRoutes.get('/:code', optionalAuth, async (c) => {
  const code = (c.req.param('code') ?? '').toUpperCase()
  const row = db.prepare('SELECT * FROM shares WHERE code = ?').get(code) as ShareRow | undefined
  if (!row || row.status !== 'ready' || !row.path || !existsSync(row.path)) {
    return c.json({ message: 'this code does not exist or has expired' }, 404)
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return c.json({ message: 'this code does not exist or has expired' }, 404)
  }

  if (c.req.query('meta') === '1') {
    return c.json({ revision: row.revision })
  }

  if (c.req.query('url') === '1') {
    return c.json({
      url: `${env.publicUrl}/api/share/${code}/download`,
    })
  }

  const stream = createReadStream(row.path)
  return new Response(Readable.toWeb(stream) as BodyInit, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Length': String(statSync(row.path).size),
    },
  })
})

shareRoutes.get('/:code/download', async (c) => {
  const code = (c.req.param('code') ?? '').toUpperCase()
  const row = db.prepare('SELECT * FROM shares WHERE code = ?').get(code) as ShareRow | undefined
  if (!row || row.status !== 'ready' || !row.path || !existsSync(row.path)) {
    return c.json({ message: 'this code does not exist or has expired' }, 404)
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return c.json({ message: 'this code does not exist or has expired' }, 404)
  }
  const stream = createReadStream(row.path)
  return new Response(Readable.toWeb(stream) as BodyInit, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Length': String(statSync(row.path).size),
      'Content-Disposition': `attachment; filename="${code}.zip"`,
    },
  })
})

export function purgeExpiredShares() {
  const now = new Date().toISOString()
  const rows = db.prepare('SELECT code, path FROM shares WHERE expires_at < ?').all(now) as { code: string, path: string | null }[]
  for (const r of rows) {
    if (r.path && existsSync(r.path)) {
      try { unlinkSync(r.path) } catch { /* ignore */ }
    }
    db.prepare('DELETE FROM shares WHERE code = ?').run(r.code)
  }
  return rows.length
}
