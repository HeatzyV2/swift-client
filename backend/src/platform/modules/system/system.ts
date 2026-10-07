// Health, readiness, version and the generated OpenAPI document.
import { accessSync, constants } from 'node:fs'
import type { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../../../db.js'
import { env } from '../../../env.js'
import { defineRoute, ok, registry, type PEnv } from '../../core/http.js'
import { ROLES } from '../../core/rbac.js'
import { migrations } from '../../migrations.js'

const startedAt = Date.now()

export function readiness() {
  const checks: Record<string, { ok: boolean, detail?: string }> = {}
  try {
    db.prepare('SELECT 1').get()
    const applied = (db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get() as { n: number }).n
    checks.database = { ok: applied === migrations.length, detail: `${applied}/${migrations.length} migrations` }
  } catch {
    checks.database = { ok: false, detail: 'unreachable' }
  }
  try {
    accessSync(env.dataDir, constants.R_OK | constants.W_OK)
    checks.storage = { ok: true }
  } catch {
    checks.storage = { ok: false, detail: 'data directory is not writable' }
  }
  checks.auth = { ok: !env.insecureSecret, detail: env.insecureSecret ? 'JWT_SECRET is not set: platform sign-in disabled' : undefined }
  // Auth being disabled degrades the admin, it does not make the API unready for launchers.
  const ready = checks.database.ok && checks.storage.ok
  return { ready, checks }
}

export const versionInfo = () => ({ name: 'swift-platform', version: env.version, apiVersion: 1, environment: env.appEnv, uptimeSec: Math.round((Date.now() - startedAt) / 1000) })

function schemaOf(s: z.ZodType | undefined, io: 'input' = 'input'): Record<string, unknown> | undefined {
  if (!s) return undefined
  try {
    const { $schema: _s, ...rest } = z.toJSONSchema(s, { io, unrepresentable: 'any' }) as Record<string, unknown>
    return rest
  } catch {
    return { type: 'object' }
  }
}

export function buildOpenApi() {
  const paths: Record<string, Record<string, unknown>> = {}
  for (const r of registry) {
    const path = r.path.replace(/:([A-Za-z]+)/g, '{$1}')
    const params = [...r.path.matchAll(/:([A-Za-z]+)/g)].map(m => ({ name: m[1], in: 'path', required: true, schema: { type: 'string' } }))
    const q = schemaOf(r.query) as { properties?: Record<string, unknown>, required?: string[] } | undefined
    for (const [name, schema] of Object.entries(q?.properties ?? {})) params.push({ name, in: 'query', required: !!q?.required?.includes(name), schema: schema as { type: string } } as never)
    const body = schemaOf(r.body)
    ;(paths[path] ??= {})[r.method] = {
      summary: r.summary, tags: [r.tag], operationId: `${r.method}_${path.replace(/[^A-Za-z0-9]+/g, '_')}`,
      ...(r.auth === 'public' ? {} : { security: [{ bearerAuth: [] }], 'x-permission': r.auth === 'user' ? 'any signed-in user' : r.auth }),
      parameters: params,
      ...(body ? { requestBody: { required: true, content: { 'application/json': { schema: body } } } } : {}),
      responses: {
        200: { description: 'Success: { success: true, data, meta }' },
        ...(r.auth === 'public' ? {} : { 401: { description: 'UNAUTHORIZED' }, 403: { description: 'FORBIDDEN' } }),
        422: { description: 'VALIDATION_ERROR' }, 429: { description: 'RATE_LIMITED' },
      },
    }
  }
  return {
    openapi: '3.0.3',
    info: { title: 'Swift Platform API', version: env.version, description: 'Versioned API of the Swift Client platform. Success: { success: true, data, meta }. Error: { success: false, error: { code, message, details? } }.' },
    servers: [{ url: env.publicUrl }],
    tags: [...new Set(registry.map(r => r.tag))].map(name => ({ name })),
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } }, 'x-roles': ROLES },
    paths,
  }
}

export function registerSystem(app: Hono<PEnv>) {
  defineRoute(app, { method: 'get', path: '/health', tag: 'System', auth: 'public', summary: 'Liveness: the process answers' }, () => ok({ status: 'ok' }))
  defineRoute(app, { method: 'get', path: '/ready', tag: 'System', auth: 'public', summary: 'Readiness: database migrated, storage writable' }, (c) => {
    const r = readiness()
    return new Response(JSON.stringify({ success: r.ready, data: r, meta: { requestId: c.get('requestId') } }), { status: r.ready ? 200 : 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
  })
  defineRoute(app, { method: 'get', path: '/version', tag: 'System', auth: 'public', summary: 'Platform version' }, () => ok(versionInfo()))
  defineRoute(app, { method: 'get', path: '/openapi.json', tag: 'System', auth: 'public', summary: 'OpenAPI 3 document' }, (c) =>
    c.json(buildOpenApi()))
}
