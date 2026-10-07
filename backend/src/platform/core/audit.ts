// Audit log: who did what, when, from where, with the before/after state (secrets redacted).
import { db } from '../../db.js'
import { env } from '../../env.js'
import type { PContext } from './http.js'
import { redact } from './logger.js'
import { newId, nowIso, toJson } from './util.js'

export type AuditOpts = { summary?: string, before?: unknown, after?: unknown }

export function audit(c: PContext | null, action: string, entityType: string | null, entityId: string | null, opts: AuditOpts = {}): void {
  const actor = c?.get('actor') ?? null
  db.prepare(`INSERT INTO audit_logs (id, at, actor_id, actor_name, action, entity_type, entity_id, summary, before_json, after_json, ip, request_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    newId(16), nowIso(), actor?.id ?? null, actor?.username ?? null, action, entityType, entityId,
    opts.summary?.slice(0, 300) ?? null,
    opts.before === undefined ? null : toJson(redact(opts.before)),
    opts.after === undefined ? null : toJson(redact(opts.after)),
    c?.get('ip') ?? null, c?.get('requestId') ?? null,
  )
}

export function purgeAudit(): void {
  const cutoff = new Date(Date.now() - env.auditRetentionDays * 86_400_000).toISOString()
  db.prepare('DELETE FROM audit_logs WHERE at < ?').run(cutoff)
}
