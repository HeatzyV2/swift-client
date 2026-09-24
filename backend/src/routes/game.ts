// Routes used by the Swift Client mod (in game). Authenticated with the token from
// POST /api/auth/minecraft; the mod identifies players by Minecraft UUID.
import { existsSync, readFileSync } from 'node:fs'
import { Hono } from 'hono'
import { requireAuth, findUserById, type AuthVariables } from '../auth.js'
import { db, type UserRow } from '../db.js'
import { env } from '../env.js'
import { findUserByMinecraft, normUuid } from '../minecraft.js'
import { relayInfo } from '../relay.js'

type CosmeticRow = {
  id: string
  type: string
  name: string
  price: number
  frames: number
  fps: number
  frame_w: number
  frame_h: number
  texture_path: string | null
  model_path: string | null
  animation_path: string | null
  loop_anim: string
  player_skin: number
}

/** A player is "online" when their game sent a heartbeat this recently. */
export const ONLINE_WINDOW_MS = 60_000
/** At most this many UUIDs per batch lookup. */
const MAX_BATCH = 200

function me(c: { get: (k: 'user') => { id: string } }): UserRow | undefined {
  return findUserById(c.get('user').id)
}

async function uuidsFrom(req: { json: () => Promise<unknown> }): Promise<string[]> {
  const body = await req.json().catch(() => null) as { uuids?: unknown } | null
  const list = Array.isArray(body?.uuids) ? body!.uuids as unknown[] : []
  return list.filter((u): u is string => typeof u === 'string' && /^[0-9a-fA-F-]{32,36}$/.test(u)).slice(0, MAX_BATCH)
}

/** UUID (as sent) -> Swift account, for the players that have one. */
function usersFor(uuids: string[]): Map<string, UserRow> {
  const out = new Map<string, UserRow>()
  for (const u of uuids) {
    const row = findUserByMinecraft(u)
    if (row) out.set(u, row)
  }
  return out
}

function swiftPlus(row: UserRow): boolean {
  return !!row.swift_plus_until && new Date(row.swift_plus_until).getTime() > Date.now()
}

function cosmetic(id: string): CosmeticRow | undefined {
  return db.prepare('SELECT * FROM cosmetics WHERE id = ?').get(id) as CosmeticRow | undefined
}

function owns(userId: string, cosmeticId: string): boolean {
  return !!db.prepare('SELECT 1 FROM user_cosmetics WHERE user_id = ? AND cosmetic_id = ?').get(userId, cosmeticId)
}

function readPartners(): { name: string, ip: string, port: number }[] {
  try {
    if (existsSync(env.partnersFile)) {
      const raw = JSON.parse(readFileSync(env.partnersFile, 'utf8')) as { servers?: unknown }
      if (Array.isArray(raw.servers)) {
        return raw.servers
          .filter((s): s is { name: string, ip: string, port?: number } => typeof s?.name === 'string' && typeof s?.ip === 'string')
          .map(s => ({ name: s.name, ip: s.ip, port: typeof s.port === 'number' ? s.port : 25565 }))
      }
    }
  } catch (e) {
    console.error('[partners] unreadable', e)
  }
  return [{ name: 'Elysia SMP', ip: 'elysiasmp.com', port: 25565 }]
}

export const gameRoutes = new Hono<{ Variables: AuthVariables }>()

// --- Public ---------------------------------------------------------------------------------

gameRoutes.get('/partners/ingame', (c) => c.json({ slots: readPartners() }))
gameRoutes.get('/servers', (c) => c.json(readPartners()))
gameRoutes.get('/relay', (c) => {
  const info = relayInfo()
  return info ? c.json(info) : c.json({ message: 'relay disabled' }, 404)
})

gameRoutes.get('/cosmetics/catalog', (c) => {
  const rows = db.prepare('SELECT * FROM cosmetics ORDER BY type, name COLLATE NOCASE').all() as CosmeticRow[]
  return c.json(rows.map(r => ({
    id: r.id,
    type: r.type,
    name: r.name,
    price: r.price,
    frames: r.frames,
    fps: r.fps,
    frameW: r.frame_w,
    frameH: r.frame_h,
  })))
})

gameRoutes.get('/subscription/status/:uuid', (c) => {
  const row = findUserByMinecraft(c.req.param('uuid'))
  return c.json({ active: !!row && swiftPlus(row), until: row?.swift_plus_until ?? null })
})

gameRoutes.get('/shop/balance/:uuid', (c) => {
  const row = findUserByMinecraft(c.req.param('uuid'))
  return c.json({ coins: row?.coins ?? 0 })
})

// --- Signed in (game token) -----------------------------------------------------------------

gameRoutes.use('/users/*', requireAuth)
gameRoutes.use('/cosmetics/*', requireAuth)

gameRoutes.post('/users/heartbeat', async (c) => {
  const body = await c.req.json().catch(() => null) as { server?: string } | null
  const server = typeof body?.server === 'string' ? body.server.slice(0, 255) : null
  db.prepare('UPDATE users SET last_seen = ?, current_server = ? WHERE id = ?').run(new Date().toISOString(), server, c.get('user').id)
  return c.json({ ok: true })
})

/** Badge grade of each Swift player: their grade, "swift_plus", or "member". Others are absent. */
gameRoutes.post('/users/grades', async (c) => {
  const out: Record<string, string> = {}
  for (const [uuid, row] of usersFor(await uuidsFrom(c.req))) {
    out[uuid] = row.grade || (swiftPlus(row) ? 'swift_plus' : 'member')
  }
  return c.json(out)
})

gameRoutes.post('/cosmetics/equipped', async (c) => {
  const out: Record<string, string> = {}
  for (const [uuid, row] of usersFor(await uuidsFrom(c.req))) {
    if (row.equipped_cape) out[uuid] = row.equipped_cape
    else if (row.mojang_cape_url) out[uuid] = `mojang:${row.mojang_cape_url}`
  }
  return c.json(out)
})

gameRoutes.post('/cosmetics/animated', async (c) => {
  const out: Record<string, boolean> = {}
  for (const [uuid, row] of usersFor(await uuidsFrom(c.req))) out[uuid] = (row.cape_animated ?? 1) !== 0
  return c.json(out)
})

gameRoutes.post('/cosmetics/pets', async (c) => {
  const out: Record<string, string> = {}
  for (const [uuid, row] of usersFor(await uuidsFrom(c.req))) {
    if (row.equipped_pet) out[uuid] = row.equipped_pet
  }
  return c.json(out)
})

gameRoutes.get('/cosmetics/owned/:uuid', (c) => {
  const row = me(c)
  if (!row) return c.json({ message: 'user not found' }, 401)
  if (!row.mc_uuid || normUuid(row.mc_uuid) !== normUuid(c.req.param('uuid'))) {
    return c.json({ message: 'not your account' }, 403)
  }
  const owned = (db.prepare('SELECT cosmetic_id FROM user_cosmetics WHERE user_id = ?').all(row.id) as { cosmetic_id: string }[])
    .map(r => r.cosmetic_id)
  return c.json({ owned, equipped: row.equipped_cape ?? null, equippedPet: row.equipped_pet ?? null })
})

gameRoutes.post('/cosmetics/buy', async (c) => {
  const row = me(c)
  const body = await c.req.json().catch(() => null) as { id?: string } | null
  const item = body?.id ? cosmetic(body.id) : undefined
  if (!row) return c.json({ message: 'user not found' }, 401)
  if (!item) return c.json({ message: 'unknown cosmetic' }, 404)
  if (owns(row.id, item.id)) return c.json({ ok: true, coins: row.coins ?? 0 })
  const bought = db.transaction(() => {
    const res = db.prepare('UPDATE users SET coins = coins - ? WHERE id = ? AND coins >= ?').run(item.price, row.id, item.price)
    if (res.changes === 0) return false
    db.prepare('INSERT INTO user_cosmetics (user_id, cosmetic_id, created_at) VALUES (?, ?, ?)').run(row.id, item.id, new Date().toISOString())
    return true
  })()
  if (!bought) return c.json({ message: 'not enough coins' }, 402)
  return c.json({ ok: true, coins: findUserById(row.id)!.coins ?? 0 })
})

gameRoutes.post('/cosmetics/equip', async (c) => {
  const row = me(c)
  const body = await c.req.json().catch(() => null) as { id?: string } | null
  const id = body?.id ?? 'none'
  if (!row) return c.json({ message: 'user not found' }, 401)
  if (id !== 'none') {
    const item = cosmetic(id)
    if (!item || item.type !== 'cape') return c.json({ message: 'unknown cape' }, 404)
    if (item.price > 0 && !owns(row.id, id)) return c.json({ message: 'you do not own this cape' }, 403)
  }
  db.prepare('UPDATE users SET equipped_cape = ? WHERE id = ?').run(id === 'none' ? null : id, row.id)
  return c.json({ ok: true })
})

gameRoutes.post('/cosmetics/equip-pet', async (c) => {
  const row = me(c)
  const body = await c.req.json().catch(() => null) as { id?: string } | null
  const id = body?.id ?? 'none'
  if (!row) return c.json({ message: 'user not found' }, 401)
  if (id !== 'none') {
    const item = cosmetic(id)
    if (!item || item.type !== 'pet') return c.json({ message: 'unknown pet' }, 404)
    if (item.price > 0 && !owns(row.id, id)) return c.json({ message: 'you do not own this pet' }, 403)
  }
  db.prepare('UPDATE users SET equipped_pet = ? WHERE id = ?').run(id === 'none' ? null : id, row.id)
  return c.json({ ok: true })
})

gameRoutes.post('/cosmetics/cape-animated', async (c) => {
  const body = await c.req.json().catch(() => null) as { enabled?: boolean } | null
  db.prepare('UPDATE users SET cape_animated = ? WHERE id = ?').run(body?.enabled === false ? 0 : 1, c.get('user').id)
  return c.json({ ok: true })
})

/** The player's own Mojang cape, so other Swift players can render it. */
gameRoutes.post('/cosmetics/mojang-cape', async (c) => {
  const body = await c.req.json().catch(() => null) as { url?: string | null } | null
  const url = typeof body?.url === 'string' && /^https?:\/\/textures\.minecraft\.net\/texture\/[0-9a-fA-F]+$/.test(body.url) ? body.url : null
  db.prepare('UPDATE users SET mojang_cape_url = ? WHERE id = ?').run(url, c.get('user').id)
  return c.json({ ok: true })
})

gameRoutes.get('/cosmetics/texture/:id', (c) => {
  const item = cosmetic(c.req.param('id'))
  if (!item?.texture_path || !existsSync(item.texture_path)) return c.json({ message: 'texture not found' }, 404)
  return new Response(readFileSync(item.texture_path), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' },
  })
})

gameRoutes.get('/cosmetics/pet-model/:id', (c) => {
  const item = cosmetic(c.req.param('id'))
  if (!item || item.type !== 'pet' || !item.model_path || !existsSync(item.model_path)) {
    return c.json({ message: 'pet model not found' }, 404)
  }
  const read = (p: string | null) => (p && existsSync(p) ? readFileSync(p) : null)
  const anim = read(item.animation_path)
  const tex = read(item.texture_path)
  return c.json({
    geo: JSON.parse(readFileSync(item.model_path, 'utf8')),
    animation: anim ? JSON.parse(anim.toString('utf8')) : null,
    texture: tex ? tex.toString('base64') : null,
    loopAnim: item.loop_anim,
    playerSkin: item.player_skin !== 0,
  })
})
