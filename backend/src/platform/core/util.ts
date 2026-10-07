import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { nanoid } from 'nanoid'

export const newId = (n = 14) => nanoid(n)
export const nowIso = () => new Date().toISOString()
export const sha256 = (v: string | Buffer) => createHash('sha256').update(v).digest('hex')
export const hmac = (key: string, v: string) => createHmac('sha256', key).update(v).digest('hex')
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url')

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export function toJson(v: unknown): string {
  return JSON.stringify(v ?? null)
}

export function fromJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string' || !raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/** Escape % _ \ for a LIKE ... ESCAPE '\' pattern. */
export const likeEscape = (s: string) => s.replace(/[\\%_]/g, m => `\\${m}`)

/** Compare dotted numeric versions ("1.3.0" vs "1.10.2"); a -suffix (beta) sorts below the bare version. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('-')[0].split('.').map(n => parseInt(n, 10) || 0)
  const pb = b.split('-')[0].split('.').map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length, 3); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d) return d < 0 ? -1 : 1
  }
  const sa = a.includes('-')
  const sb = b.includes('-')
  return sa === sb ? 0 : sa ? -1 : 1
}

/** Localized text: { fr: '...', en: '...' }. Falls back locale, then en, then fr, then the first value. */
export type Localized = Record<string, string>
export function pickLocale(v: Localized | null | undefined, locale?: string): string {
  if (!v) return ''
  const l = (locale ?? 'en').toLowerCase().split(/[-_]/)[0]
  return v[l] ?? v.en ?? v.fr ?? Object.values(v)[0] ?? ''
}
