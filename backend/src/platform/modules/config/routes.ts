// Routes for settings, feature flags (with A/B variants) and remote config.
import type { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../../../db.js'
import { audit } from '../../core/audit.js'
import { cache } from '../../core/cache.js'
import { badRequest, notFound } from '../../core/errors.js'
import { emit } from '../../core/events.js'
import { actorOf, created, defineRoute, ok, type PEnv } from '../../core/http.js'
import { bucket, matches, type ClientContext } from '../../core/schemas.js'
import { fromJson, nowIso, toJson } from '../../core/util.js'
import { describeFlag, flagInput, flagKey, getSetting, SETTINGS, type FlagRow, type SettingKey } from './config.js'

export type FlagResult = { flags: Record<string, boolean>, experiments: Record<string, string> }

/** Evaluates every flag for a client. Disabled or non-targeted flags are false; A/B arms are assigned by stable hash. */
export function evaluateFlags(ctx: ClientContext): FlagResult {
  const rows = cache.get('flags:all', 30_000, ['flags'], () => db.prepare('SELECT * FROM feature_flags').all() as FlagRow[])
  const out: FlagResult = { flags: {}, experiments: {} }
  for (const r of rows) {
    const f = describeFlag(r)
    const on = f.enabled && matches(f.targeting, ctx, `flag:${f.key}`)
    out.flags[f.key] = on
    if (on && f.variants.length) {
      let variant = 'control'
      if (ctx.device) {
        const b = bucket(ctx.device, `variant:${f.key}`)
        let acc = 0
        for (const v of f.variants) {
          acc += v.weight
          if (b < acc) { variant = v.key; break }
        }
      }
      out.experiments[f.key] = variant
    }
  }
  return out
}

const configKey = z.string().trim().regex(/^[a-z0-9][a-zA-Z0-9._-]{1,63}$/, 'letters, numbers, dot, dash, underscore')
const configValue = z.union([z.string().max(2000), z.number(), z.boolean(), z.array(z.any()).max(100), z.record(z.string(), z.any())])
  .refine(v => JSON.stringify(v).length <= 4000, 'Value is limited to 4000 characters of JSON')
const configInput = z.object({ value: configValue, description: z.string().trim().max(200).nullable().optional() })

type CfgRow = { key: string, value: string, description: string | null, updated_at: string }

export function remoteConfig(): Record<string, unknown> {
  return cache.get('remote-config', 30_000, ['config'], () =>
    Object.fromEntries((db.prepare('SELECT key, value FROM remote_config ORDER BY key').all() as { key: string, value: string }[]).map(r => [r.key, fromJson(r.value, null)])))
}

export function registerConfig(app: Hono<PEnv>) {
  defineRoute(app, { method: 'get', path: '/settings', tag: 'Settings', auth: 'settings.read', summary: 'All platform settings' }, () =>
    ok(Object.fromEntries((Object.keys(SETTINGS) as SettingKey[]).map(k => [k, getSetting(k)]))))

  defineRoute(app, { method: 'put', path: '/settings/:key', tag: 'Settings', auth: 'settings.write', summary: 'Replace a setting (maintenance, analytics, links)' }, async (c, { params }) => {
    const key = params.key as SettingKey
    if (!(key in SETTINGS)) throw notFound('Setting')
    const raw = await c.req.json().catch(() => null)
    const parsed = SETTINGS[key].safeParse(raw)
    if (!parsed.success) throw badRequest('Invalid setting value', parsed.error.issues.slice(0, 10).map(i => ({ path: i.path.join('.'), message: i.message })))
    const before = getSetting(key)
    db.prepare(`INSERT INTO settings (key, value, updated_at, updated_by) VALUES (?,?,?,?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`).run(key, toJson(parsed.data), nowIso(), actorOf(c).id)
    cache.invalidate('settings', 'launcher')
    audit(c, `settings.${key}_changed`, 'setting', key, { before, after: parsed.data })
    if (key === 'maintenance') emit('maintenance.changed', { enabled: (parsed.data as { enabled: boolean }).enabled })
    return ok(getSetting(key))
  })

  defineRoute(app, { method: 'get', path: '/flags', tag: 'Flags', auth: 'config.read', summary: 'List feature flags' }, () =>
    ok((db.prepare('SELECT * FROM feature_flags ORDER BY key').all() as FlagRow[]).map(describeFlag)))

  defineRoute(app, { method: 'put', path: '/flags/:key', tag: 'Flags', auth: 'config.write', summary: 'Create or update a feature flag', body: flagInput }, (c, { params, body }) => {
    const key = flagKey.safeParse(params.key)
    if (!key.success) throw badRequest('Invalid flag key')
    const row = db.prepare('SELECT * FROM feature_flags WHERE key = ?').get(key.data) as FlagRow | undefined
    const now = nowIso()
    db.prepare(`INSERT INTO feature_flags (key, description, enabled, targeting, variants, created_at, updated_at) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(key) DO UPDATE SET description=excluded.description, enabled=excluded.enabled, targeting=excluded.targeting, variants=excluded.variants, updated_at=excluded.updated_at`)
      .run(key.data, body.description ?? null, body.enabled ? 1 : 0, toJson(body.targeting), toJson(body.variants), now, now)
    cache.invalidate('flags', 'launcher')
    audit(c, row ? 'flag.updated' : 'flag.created', 'flag', key.data, { before: row && describeFlag(row), after: body })
    const out = describeFlag(db.prepare('SELECT * FROM feature_flags WHERE key = ?').get(key.data) as FlagRow)
    return row ? ok(out) : created(out)
  })

  defineRoute(app, { method: 'delete', path: '/flags/:key', tag: 'Flags', auth: 'config.write', summary: 'Delete a feature flag' }, (c, { params }) => {
    const row = db.prepare('SELECT * FROM feature_flags WHERE key = ?').get(params.key) as FlagRow | undefined
    if (!row) throw notFound('Flag')
    db.prepare('DELETE FROM feature_flags WHERE key = ?').run(row.key)
    cache.invalidate('flags', 'launcher')
    audit(c, 'flag.deleted', 'flag', row.key, { before: describeFlag(row) })
    return ok({ deleted: true })
  })

  defineRoute(app, { method: 'get', path: '/remote-config', tag: 'Config', auth: 'config.read', summary: 'List remote config entries' }, () =>
    ok((db.prepare('SELECT * FROM remote_config ORDER BY key').all() as CfgRow[]).map(r => ({ key: r.key, value: fromJson(r.value, null), description: r.description, updatedAt: r.updated_at }))))

  defineRoute(app, { method: 'put', path: '/remote-config/:key', tag: 'Config', auth: 'config.write', summary: 'Create or update a remote config value (JSON data only)', body: configInput }, (c, { params, body }) => {
    const key = configKey.safeParse(params.key)
    if (!key.success) throw badRequest('Invalid config key')
    const row = db.prepare('SELECT * FROM remote_config WHERE key = ?').get(key.data) as CfgRow | undefined
    db.prepare(`INSERT INTO remote_config (key, value, description, updated_at) VALUES (?,?,?,?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, description=excluded.description, updated_at=excluded.updated_at`).run(key.data, toJson(body.value), body.description ?? null, nowIso())
    cache.invalidate('config', 'launcher')
    audit(c, row ? 'config.updated' : 'config.created', 'remote_config', key.data, { before: row && fromJson(row.value, null), after: body.value })
    return ok({ key: key.data, value: body.value, description: body.description ?? null })
  })

  defineRoute(app, { method: 'delete', path: '/remote-config/:key', tag: 'Config', auth: 'config.write', summary: 'Delete a remote config value' }, (c, { params }) => {
    const row = db.prepare('SELECT * FROM remote_config WHERE key = ?').get(params.key) as CfgRow | undefined
    if (!row) throw notFound('Config entry')
    db.prepare('DELETE FROM remote_config WHERE key = ?').run(row.key)
    cache.invalidate('config', 'launcher')
    audit(c, 'config.deleted', 'remote_config', row.key, { before: fromJson(row.value, null) })
    return ok({ deleted: true })
  })
}
