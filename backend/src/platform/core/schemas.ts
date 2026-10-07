// Shared validation schemas and the targeting engine (who sees a section, campaign, flag or release).
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { compareVersions } from './util.js'

export const LOCALES = ['fr', 'en', 'es', 'de', 'pt', 'it', 'ru', 'zh', 'ja', 'ko', 'pl', 'nl', 'tr'] as const

/** Text per language. At least one language is required; `en` or `fr` is used as fallback when reading. */
export const localized = (max = 2000) =>
  z.record(z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'locale code like fr or en-US'), z.string().trim().max(max))
    .refine(v => Object.values(v).some(t => t.length > 0), 'At least one language is required')
    .refine(v => Object.keys(v).length <= 20, 'Too many languages')

export const optionalLocalized = (max = 2000) =>
  z.record(z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/), z.string().trim().max(max)).refine(v => Object.keys(v).length <= 20).default({})

/** Only http(s) and swift:// links: never javascript:, data: or file:. */
export const safeUrl = z.string().trim().max(600).refine(u => /^(https?|swift):\/\/[^\s]+$/i.test(u), 'Must be an http(s) or swift:// URL')

/** An image is an uploaded asset ("asset:<id>") or an https URL. */
export const imageRef = z.string().trim().max(600).refine(u => /^asset:[A-Za-z0-9_-]{6,40}$/.test(u) || /^https:\/\/[^\s]+$/i.test(u), 'Must be asset:<id> or an https URL')

export const isoDate = z.string().datetime({ offset: true }).transform(s => new Date(s).toISOString())
export const channel = z.enum(['stable', 'beta', 'canary', 'development'])
export const platform = z.enum(['windows', 'macos', 'linux'])
export const arch = z.enum(['x64', 'arm64', 'x86'])
export const version = z.string().trim().regex(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/, 'Semantic version like 1.4.0 or 1.4.0-beta.1')
export const id = z.string().regex(/^[A-Za-z0-9_-]{6,40}$/)
export const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase letters, numbers and dashes').max(80)

export const targetingSchema = z.object({
  launcherVersion: z.object({ min: version.optional(), max: version.optional() }).strict().optional(),
  mcVersions: z.array(z.string().trim().max(24)).max(60).optional(),
  os: z.array(platform).max(3).optional(),
  arch: z.array(arch).max(3).optional(),
  locales: z.array(z.string().trim().max(10)).max(20).optional(),
  authenticated: z.boolean().optional(),
  channels: z.array(channel).max(4).optional(),
  rolloutPercent: z.number().int().min(0).max(100).optional(),
}).strict()
export type Targeting = z.output<typeof targetingSchema>

/** What the launcher tells us about itself (query string; nothing personal). */
export type ClientContext = {
  launcherVersion?: string
  mcVersion?: string
  os?: string
  arch?: string
  locale?: string
  authenticated?: boolean
  channel?: string
  device?: string
}

export const clientContextQuery = z.object({
  v: z.string().max(32).optional(),
  mc: z.string().max(24).optional(),
  os: z.string().max(16).optional(),
  arch: z.string().max(16).optional(),
  locale: z.string().max(10).optional(),
  auth: z.enum(['0', '1', 'true', 'false']).optional(),
  channel: z.string().max(16).optional(),
  device: z.string().max(64).optional(),
})

export function toContext(q: z.output<typeof clientContextQuery>): ClientContext {
  return {
    launcherVersion: q.v,
    mcVersion: q.mc,
    os: q.os?.toLowerCase(),
    arch: q.arch?.toLowerCase(),
    locale: q.locale?.toLowerCase().split(/[-_]/)[0],
    authenticated: q.auth === undefined ? undefined : q.auth === '1' || q.auth === 'true',
    channel: q.channel?.toLowerCase(),
    device: q.device,
  }
}

/** Stable 0..99 bucket for (device, item): the same device always lands in the same bucket. */
export function bucket(device: string, itemId: string): number {
  const h = createHash('sha256').update(`${device}:${itemId}`).digest()
  return h.readUInt32BE(0) % 100
}

/** Empty targeting matches everyone. A criterion the client did not report never matches when it is required. */
export function matches(t: Targeting | Record<string, never> | null | undefined, ctx: ClientContext, itemId: string): boolean {
  if (!t || Object.keys(t).length === 0) return true
  const x = t as Targeting
  if (x.launcherVersion) {
    if (!ctx.launcherVersion) return false
    if (x.launcherVersion.min && compareVersions(ctx.launcherVersion, x.launcherVersion.min) < 0) return false
    if (x.launcherVersion.max && compareVersions(ctx.launcherVersion, x.launcherVersion.max) > 0) return false
  }
  if (x.mcVersions?.length && !(ctx.mcVersion && x.mcVersions.includes(ctx.mcVersion))) return false
  if (x.os?.length && !(ctx.os && (x.os as string[]).includes(ctx.os))) return false
  if (x.arch?.length && !(ctx.arch && (x.arch as string[]).includes(ctx.arch))) return false
  if (x.locales?.length && !(ctx.locale && x.locales.map(l => l.toLowerCase().split(/[-_]/)[0]).includes(ctx.locale))) return false
  if (x.authenticated !== undefined && ctx.authenticated !== x.authenticated) return false
  if (x.channels?.length && !(ctx.channel && (x.channels as string[]).includes(ctx.channel))) return false
  if (x.rolloutPercent !== undefined && x.rolloutPercent < 100) {
    if (x.rolloutPercent <= 0 || !ctx.device) return false
    if (bucket(ctx.device, itemId) >= x.rolloutPercent) return false
  }
  return true
}

/** Scheduling window: [startsAt, endsAt). Missing bounds are open. */
export function inWindow(startsAt: string | null, endsAt: string | null, now = new Date().toISOString()): boolean {
  return (!startsAt || startsAt <= now) && (!endsAt || endsAt > now)
}

export const bool01 = (v: unknown) => (v ? 1 : 0)
