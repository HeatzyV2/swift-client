// Structured JSON logs, one line per event. Secrets are redacted by key name, never logged by value.
import { env } from '../../env.js'

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 } as const
const SECRET_KEYS = /pass(word)?|secret|token|authorization|cookie|signature|api[-_]?key|hash/i

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value == null) return value
  if (Array.isArray(value)) return value.slice(0, 50).map(v => redact(v, depth + 1))
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEYS.test(k) ? '[redacted]' : redact(v, depth + 1)
    }
    return out
  }
  return typeof value === 'string' && value.length > 500 ? `${value.slice(0, 500)}…` : value
}

function emit(level: keyof typeof LEVELS, msg: string, fields?: Record<string, unknown>) {
  if (LEVELS[level] < LEVELS[env.logLevel]) return
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...(redact(fields) as object) })
  if (level === 'error' || level === 'warn') console.error(line)
  else console.log(line)
}

export const log = {
  debug: (msg: string, f?: Record<string, unknown>) => emit('debug', msg, f),
  info: (msg: string, f?: Record<string, unknown>) => emit('info', msg, f),
  warn: (msg: string, f?: Record<string, unknown>) => emit('warn', msg, f),
  error: (msg: string, f?: Record<string, unknown>) => emit('error', msg, f),
}

/** Error object -> loggable fields. The stack goes to the logs only, never to a client. */
export function errFields(err: unknown): Record<string, unknown> {
  if (err instanceof Error) return { error: err.message, stack: err.stack?.split('\n').slice(0, 6).join('\n') }
  return { error: String(err) }
}
