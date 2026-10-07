// Settings (maintenance, analytics switch, links), feature flags (with optional A/B variants) and remote
// config. Everything here is plain data the launcher reads: no code, no scripts, no URLs to execute.
import type { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../../../db.js'
import { audit } from '../../core/audit.js'
import { cache } from '../../core/cache.js'
import { badRequest, notFound } from '../../core/errors.js'
import { emit } from '../../core/events.js'
import { actorOf, created, defineRoute, ok, type PEnv } from '../../core/http.js'
import { bucket, inWindow, isoDate, matches, optionalLocalized, safeUrl, targetingSchema, type ClientContext, type Targeting } from '../../core/schemas.js'
import { fromJson, nowIso, toJson, type Localized } from '../../core/util.js'

// ---- Settings ---------------------------------------------------------------------------------------

export const SETTINGS = {
  maintenance: z.object({
    enabled: z.boolean().default(false),
    message: optionalLocalized(400),
    startsAt: isoDate.nullable().optional(),
    endsAt: isoDate.nullable().optional(),
    /** Launcher versions allowed through during maintenance (testers). */
    allowVersions: z.array(z.string().max(32)).max(20).default([]),
  }).strict(),
  analytics: z.object({ enabled: z.boolean().default(true) }).strict(),
  links: z.object({
    website: safeUrl.nullable().optional(), discord: safeUrl.nullable().optional(),
    support: safeUrl.nullable().optional(), status: safeUrl.nullable().optional(), privacy: safeUrl.nullable().optional(),
  }).strict(),
} as const
export type SettingKey = keyof typeof SETTINGS

const DEFAULTS: { [K in SettingKey]: z.output<typeof SETTINGS[K]> } = {
  maintenance: { enabled: false, message: {}, allowVersions: [] },
  analytics: { enabled: true },
  links: {},
}

export function getSetting<K extends SettingKey>(key: K): z.output<typeof SETTINGS[K]> {
  return cache.get(`setting:${key}`, 30_000, ['settings'], () => {
    const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
    return { ...DEFAULTS[key], ...fromJson<object>(r?.value, {}) } as z.output<typeof SETTINGS[K]>
  })
}

export function maintenanceState(ctx: ClientContext) {
  const m = getSetting('maintenance')
  const active = m.enabled && inWindow(m.startsAt ?? null, m.endsAt ?? null) && !(ctx.launcherVersion && m.allowVersions.includes(ctx.launcherVersion))
  return { active, message: m.message as Localized, startsAt: m.startsAt ?? null, endsAt: m.endsAt ?? null }
}

// ---- Flags ------------------------------------------------------------------------------------------

export const flagKey = z.string().trim().regex(/^[a-z0-9][a-z0-9._-]{1,63}$/, 'lowercase letters, numbers, dot, dash, underscore')
export const flagInput = z.object({
  description: z.string().trim().max(200).nullable().optional(),
  enabled: z.boolean().default(false),
  targeting: targetingSchema.default({}),
  /** A/B test arms. Weights are percentages of the targeted audience; the rest gets variant "control". */
  variants: z.array(z.object({ key: z.string().regex(/^[a-z0-9_-]{1,24}$/), weight: z.number().int().min(1).max(100) }).strict()).max(6).default([])
    .refine(v => v.reduce((s, x) => s + x.weight, 0) <= 100, 'Variant weights add up to more than 100'),
})

export type FlagRow = { key: string, description: string | null, enabled: number, targeting: string, variants: string, created_at: string, updated_at: string }
export const describeFlag = (r: FlagRow) => ({
  key: r.key, description: r.description, enabled: !!r.enabled, targeting: fromJson<Targeting>(r.targeting, {}),
  variants: fromJson<{ key: string, weight: number }[]>(r.variants, []), createdAt: r.created_at, updatedAt: r.updated_at,
})

