import { createWriteStream, existsSync, mkdirSync, renameSync, unlinkSync, statSync, createReadStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { resolve } from 'node:path'
import { Hono } from 'hono'
import { customAlphabet, nanoid } from 'nanoid'
import { requireAuth, findUserByUsername, findUserById, type AuthVariables } from '../auth.js'
import { db } from '../db.js'
import { env } from '../env.js'
import { findUserByMinecraftName } from '../minecraft.js'
import { ONLINE_WINDOW_MS } from './game.js'

const tokenId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 24)

type FriendRow = {
  id: string
  user_id: string
  peer_id: string | null
  username: string
  kind: string
  uuid: string | null
  status: string
  created_at: string
}

type ConvRow = {
  id: string
  user_a: string
  user_b: string
  updated_at: string
}

function mediaFile(id: string, ext: string): string {
  return resolve(env.dataDir, 'media', `${id}.${ext}`)
}

function extFromMime(mime: string): string {
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg'
  if (mime.includes('webp')) return 'webp'
  if (mime.includes('gif')) return 'gif'
  return 'png'
}

/** Online = the friend's game sent a heartbeat recently (the mod beats every 30 s). */
function presence(peerId: string | null): { online: boolean, server: string | null } {
  if (!peerId) return { online: false, server: null }
  const peer = findUserById(peerId)
  const seen = peer?.last_seen ? new Date(peer.last_seen).getTime() : 0
  const online = Date.now() - seen < ONLINE_WINDOW_MS
  return { online, server: online ? peer?.current_server ?? null : null }
}

function friendDto(row: FriendRow) {
  const { online, server } = presence(row.peer_id)
  return {
    id: row.id,
    username: row.username,
    kind: row.kind === 'offline' ? 'offline' : 'microsoft',
    uuid: row.uuid,
    status: row.status,
    online,
    server,
    created_at: row.created_at,
  }
}

function otherUser(conv: ConvRow, me: string): string {
  return conv.user_a === me ? conv.user_b : conv.user_a
}

function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a]
}

export const socialRoutes = new Hono<{ Variables: AuthVariables }>()

// Public media download (URL embedded in chat messages)
socialRoutes.get('/media/:id', (c) => {
  const id = c.req.param('id')
  const row = db.prepare('SELECT * FROM media WHERE id = ?').get(id) as {
    path: string | null
    mime: string
    status: string
    expires_at: string
    size: number | null
  } | undefined
  if (!row || row.status !== 'ready' || !row.path || !existsSync(row.path)) {
    return c.json({ message: 'media not found' }, 404)
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return c.json({ message: 'media expired' }, 410)
  }
  const stream = createReadStream(row.path)
  return new Response(Readable.toWeb(stream) as BodyInit, {
    headers: {
      'Content-Type': row.mime,
      'Content-Length': String(row.size ?? statSync(row.path).size),
      'Cache-Control': 'private, max-age=3600',
    },
  })
})

// Token-based upload (no Bearer — token is the capability)
socialRoutes.put('/media/upload/:token', async (c) => {
  const token = c.req.param('token')
  const row = db.prepare('SELECT * FROM media WHERE upload_token = ?').get(token) as {
    id: string
    mime: string
    status: string
  } | undefined
  if (!row || row.status !== 'pending') return c.json({ message: 'upload not found' }, 404)
  const body = c.req.raw.body
  if (!body) return c.json({ message: 'empty body' }, 400)
  mkdirSync(resolve(env.dataDir, 'media'), { recursive: true })
  const ext = extFromMime(row.mime)
  const dest = mediaFile(row.id, ext)
  const nodeStream = Readable.fromWeb(body as import('node:stream/web').ReadableStream)
  await pipeline(nodeStream, createWriteStream(dest))
  const st = statSync(dest)
  db.prepare(`
    UPDATE media SET path = ?, size = ?, status = 'ready', upload_token = NULL WHERE id = ?
  `).run(dest, st.size, row.id)
  return c.body(null, 204)
})

socialRoutes.use('*', requireAuth)

socialRoutes.get('/friends', (c) => {
  const user = c.get('user')
  const rows = db.prepare('SELECT * FROM friends WHERE user_id = ? ORDER BY username COLLATE NOCASE').all(user.id) as FriendRow[]
  return c.json(rows.map(friendDto))
})

socialRoutes.post('/friends/request', async (c) => {
  const user = c.get('user')
  const body = await c.req.json().catch(() => null) as { username?: string, kind?: string } | null
  const username = body?.username?.trim() ?? ''
  const kind = (body?.kind ?? 'microsoft').toLowerCase() === 'offline' ? 'offline' : 'microsoft'
  if (username.length < 3) return c.json({ message: 'enter a username' }, 400)

  // A Swift username, else the Minecraft name of a player who uses Swift Client in game.
  const peer = findUserByUsername(username) ?? findUserByMinecraftName(username)
  if (!peer) {
    // Allow adding offline/microsoft bookmarks that are not Swift users yet
    if (kind === 'microsoft') {
      // Still allow local-style friend entries without peer account
    }
  }
  const me = findUserById(user.id)
  if (peer && peer.id === user.id) {
    return c.json({ message: 'cannot add yourself' }, 400)
  }

  const existing = db.prepare(
    'SELECT * FROM friends WHERE user_id = ? AND (username = ? COLLATE NOCASE OR (peer_id IS NOT NULL AND peer_id = ?))',
  ).get(user.id, username, peer?.id ?? '') as FriendRow | undefined
  if (existing) return c.json({ message: `"${username}" is already in your friends list` }, 409)

  let uuid: string | null = peer?.mc_uuid ?? null
  let displayName = peer?.mc_username || peer?.username || username

  if (kind === 'microsoft' && !uuid) {
    try {
      const res = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`)
      if (res.ok) {
        const p = await res.json() as { id: string, name: string }
        const id = p.id
        uuid = id.includes('-')
          ? id
          : `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`
        displayName = p.name
      }
    } catch { /* ignore */ }
  }

  const id = nanoid(16)
  const created_at = new Date().toISOString()
  const status = peer ? 'accepted' : 'accepted'
  db.prepare(`
    INSERT INTO friends (id, user_id, peer_id, username, kind, uuid, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, user.id, peer?.id ?? null, displayName, kind, uuid, status, created_at)

  if (peer) {
    const recip = db.prepare(
      'SELECT 1 FROM friends WHERE user_id = ? AND peer_id = ?',
    ).get(peer.id, user.id)
    if (!recip) {
      db.prepare(`
        INSERT INTO friends (id, user_id, peer_id, username, kind, uuid, status, created_at)
        VALUES (?, ?, ?, ?, 'microsoft', ?, 'accepted', ?)
      `).run(nanoid(16), peer.id, user.id, me?.mc_username || me?.username || user.username, me?.mc_uuid ?? null, created_at)
    }
    ensureConversation(user.id, peer.id)
  }

  const row = db.prepare('SELECT * FROM friends WHERE id = ?').get(id) as FriendRow
  return c.json(friendDto(row))
})

socialRoutes.post('/friends/:id/remove', (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const row = db.prepare('SELECT * FROM friends WHERE id = ? AND user_id = ?').get(id, user.id) as FriendRow | undefined
  if (!row) return c.json({ message: 'friend not found' }, 404)
  db.prepare('DELETE FROM friends WHERE id = ?').run(id)
  if (row.peer_id) {
    db.prepare('DELETE FROM friends WHERE user_id = ? AND peer_id = ?').run(row.peer_id, user.id)
  }
  return c.json({ ok: true })
})

function ensureConversation(a: string, b: string): ConvRow {
  const [user_a, user_b] = orderedPair(a, b)
  const existing = db.prepare('SELECT * FROM conversations WHERE user_a = ? AND user_b = ?').get(user_a, user_b) as ConvRow | undefined
  if (existing) return existing
  const id = nanoid(16)
  const updated_at = new Date().toISOString()
  db.prepare('INSERT INTO conversations (id, user_a, user_b, updated_at) VALUES (?, ?, ?, ?)').run(id, user_a, user_b, updated_at)
  return { id, user_a, user_b, updated_at }
}

function conversationView(conv: ConvRow, me: string) {
  const peerId = otherUser(conv, me)
  const peer = findUserById(peerId)
  const friend = db.prepare(
    'SELECT * FROM friends WHERE user_id = ? AND peer_id = ?',
  ).get(me, peerId) as FriendRow | undefined

  const friendDtoOut = friend
    ? friendDto(friend)
    : {
        id: peerId,
        username: peer?.mc_username || peer?.username || 'Unknown',
        kind: 'microsoft' as const,
        uuid: peer?.mc_uuid ?? null,
        status: 'accepted',
        created_at: peer?.created_at ?? conv.updated_at,
      }

  const last = db.prepare(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1',
  ).get(conv.id) as {
    id: string
    conversation_id: string
    from_user: string
    text: string | null
    media_id: string | null
    created_at: string
  } | undefined

  return {
    id: conv.id,
    friend: friendDtoOut,
    updated_at: conv.updated_at,
    last_message: last ? messageDto(last, me) : null,
  }
}

function messageDto(m: {
  id: string
  conversation_id: string
  from_user: string
  text: string | null
  media_id: string | null
  created_at: string
}, me: string) {
  let image: string | null = null
  if (m.media_id) {
    const media = db.prepare('SELECT id, status, expires_at FROM media WHERE id = ?').get(m.media_id) as {
      id: string
      status: string
      expires_at: string
    } | undefined
    if (media && media.status === 'ready' && new Date(media.expires_at).getTime() > Date.now()) {
      image = `${env.publicUrl}/api/social/media/${media.id}`
    }
  }
  return {
    id: m.id,
    conversation_id: m.conversation_id,
    from: m.from_user === me ? 'me' : m.from_user,
    text: m.text,
    image,
    created_at: m.created_at,
  }
}

socialRoutes.get('/conversations', (c) => {
  const user = c.get('user')
  const rows = db.prepare(`
    SELECT * FROM conversations
    WHERE user_a = ? OR user_b = ?
    ORDER BY updated_at DESC
  `).all(user.id, user.id) as ConvRow[]
  return c.json(rows.map(r => conversationView(r, user.id)))
})

socialRoutes.post('/conversations', async (c) => {
  const user = c.get('user')
  const body = await c.req.json().catch(() => null) as { friend_id?: string } | null
  const friendId = body?.friend_id?.trim() ?? ''
  const friend = db.prepare('SELECT * FROM friends WHERE id = ? AND user_id = ?').get(friendId, user.id) as FriendRow | undefined
  if (!friend) return c.json({ message: 'friend not found' }, 404)
  if (!friend.peer_id) {
    return c.json({ message: 'this friend has no Swift account — chat needs both sides online' }, 400)
  }
  const conv = ensureConversation(user.id, friend.peer_id)
  return c.json(conversationView(conv, user.id))
})

socialRoutes.get('/conversations/:id/messages', (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const limit = Math.min(Number(c.req.query('limit') ?? 100), 200)
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as ConvRow | undefined
  if (!conv || (conv.user_a !== user.id && conv.user_b !== user.id)) {
    return c.json({ message: 'conversation not found' }, 404)
  }
  const rows = db.prepare(`
    SELECT * FROM messages WHERE conversation_id = ?
    ORDER BY created_at DESC LIMIT ?
  `).all(id, limit) as {
    id: string
    conversation_id: string
    from_user: string
    text: string | null
    media_id: string | null
    created_at: string
  }[]
  return c.json(rows.reverse().map(m => messageDto(m, user.id)))
})

socialRoutes.post('/media/upload-url', async (c) => {
  const user = c.get('user')
  const body = await c.req.json().catch(() => null) as { size?: number, mime?: string } | null
  const size = Number(body?.size ?? 0)
  const mime = (body?.mime ?? 'image/png').trim()
  if (size <= 0 || size > 8 * 1024 * 1024) {
    return c.json({ message: 'image must be between 1 byte and 8 MB' }, 400)
  }
  if (!mime.startsWith('image/')) {
    return c.json({ message: 'only images are allowed' }, 400)
  }
  const id = nanoid(16)
  const upload_token = tokenId()
  const created_at = new Date()
  const expires_at = new Date(created_at.getTime() + env.mediaTtlDays * 86_400_000)
  db.prepare(`
    INSERT INTO media (id, owner_id, mime, size, upload_token, status, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(id, user.id, mime, size, upload_token, created_at.toISOString(), expires_at.toISOString())

  return c.json({
    media_id: id,
    upload_url: `${env.publicUrl}/api/social/media/upload/${upload_token}`,
  })
})

socialRoutes.post('/conversations/:id/messages', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => null) as { text?: string, media_id?: string } | null
  const text = body?.text?.trim() || null
  const media_id = body?.media_id?.trim() || null
  if (!text && !media_id) return c.json({ message: 'message is empty' }, 400)

  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as ConvRow | undefined
  if (!conv || (conv.user_a !== user.id && conv.user_b !== user.id)) {
    return c.json({ message: 'conversation not found' }, 404)
  }
  if (media_id) {
    const media = db.prepare('SELECT * FROM media WHERE id = ? AND owner_id = ?').get(media_id, user.id) as { status: string } | undefined
    if (!media || media.status !== 'ready') {
      return c.json({ message: 'media not ready' }, 400)
    }
  }

  const msgId = nanoid(16)
  const created_at = new Date().toISOString()
  db.prepare(`
    INSERT INTO messages (id, conversation_id, from_user, text, media_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(msgId, id, user.id, text, media_id, created_at)
  db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(created_at, id)

  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(msgId) as {
    id: string
    conversation_id: string
    from_user: string
    text: string | null
    media_id: string | null
    created_at: string
  }
  return c.json(messageDto(row, user.id))
})

export function purgeExpiredMedia() {
  const now = new Date().toISOString()
  const rows = db.prepare('SELECT id, path FROM media WHERE expires_at < ?').all(now) as { id: string, path: string | null }[]
  for (const r of rows) {
    if (r.path && existsSync(r.path)) {
      try { unlinkSync(r.path) } catch { /* ignore */ }
    }
    db.prepare('UPDATE messages SET media_id = NULL WHERE media_id = ?').run(r.id)
    db.prepare('DELETE FROM media WHERE id = ?').run(r.id)
  }
  return rows.length
}
