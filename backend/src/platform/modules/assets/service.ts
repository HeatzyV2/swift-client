import { db } from '../../../db.js'
import { badRequest } from '../../core/errors.js'
import { newId, nowIso, sha256 } from '../../core/util.js'
import { storage } from './storage.js'

export type AssetRow = {
  id: string, filename: string, storage_key: string, mime: string, size: number, sha256: string,
  width: number | null, height: number | null, alt: string | null, uploaded_by: string | null, created_at: string,
}

/** Allowed types, detected from the file content, never from the name or the declared content type. SVG is refused (scriptable). */
export const ALLOWED = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' } as const

export function sniff(buf: Buffer): { mime: keyof typeof ALLOWED, width: number, height: number } | null {
  if (buf.length > 24 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: 'image/png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
  }
  if (buf.length > 10 && buf.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    let o = 2
    while (o + 9 < buf.length) {
      if (buf[o] !== 0xff) { o++; continue }
      const m = buf[o + 1]
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { mime: 'image/jpeg', height: buf.readUInt16BE(o + 5), width: buf.readUInt16BE(o + 7) }
      o += 2 + buf.readUInt16BE(o + 2)
    }
    return null
  }
  if (buf.length > 10 && buf.subarray(0, 4).toString('latin1') === 'GIF8') {
    return { mime: 'image/gif', width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) }
  }
  if (buf.length > 30 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') {
    const k = buf.subarray(12, 16).toString('latin1')
    if (k === 'VP8X') return { mime: 'image/webp', width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) }
    if (k === 'VP8 ') return { mime: 'image/webp', width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff }
    if (k === 'VP8L') {
      const b = buf.readUInt32LE(21)
      return { mime: 'image/webp', width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 }
    }
  }
  return null
}

export function describeAsset(a: AssetRow) {
  return {
    id: a.id, filename: a.filename, mime: a.mime, size: a.size, sha256: a.sha256,
    width: a.width, height: a.height, alt: a.alt, createdAt: a.created_at, uploadedBy: a.uploaded_by,
    url: storage.url(a.storage_key), ref: `asset:${a.id}`,
  }
}

export async function createAsset(buf: Buffer, filename: string, alt: string | null, userId: string | null): Promise<AssetRow> {
  const info = sniff(buf)
  if (!info) throw badRequest('Unsupported file: only PNG, JPEG, WebP and GIF images are accepted')
  if (info.width < 1 || info.height < 1 || info.width > 16384 || info.height > 16384) throw badRequest('Image dimensions are out of range')
  const hash = sha256(buf)
  const existing = db.prepare('SELECT * FROM assets WHERE sha256 = ?').get(hash) as AssetRow | undefined
  if (existing) return existing
  const id = newId(14)
  const key = `${id.slice(0, 2)}/${id}.${ALLOWED[info.mime]}`
  const clean = filename.replace(/[^\w.\- ]+/g, '_').slice(0, 120) || `upload.${ALLOWED[info.mime]}`
  await storage.put(key, buf)
  db.prepare('INSERT INTO assets (id, filename, storage_key, mime, size, sha256, width, height, alt, uploaded_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, clean, key, info.mime, buf.length, hash, info.width, info.height, alt, userId, nowIso())
  return db.prepare('SELECT * FROM assets WHERE id = ?').get(id) as AssetRow
}

/** "asset:<id>" or https URL -> public URL. Unknown asset ids resolve to null. */
export function resolveImage(ref: string | null | undefined): string | null {
  if (!ref) return null
  if (ref.startsWith('asset:')) {
    const a = db.prepare('SELECT storage_key FROM assets WHERE id = ?').get(ref.slice(6)) as { storage_key: string } | undefined
    return a ? storage.url(a.storage_key) : null
  }
  return ref
}
