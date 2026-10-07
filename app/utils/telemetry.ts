import { invoke } from '@tauri-apps/api/core'

/**
 * Privacy-first telemetry towards the Swift Platform (see `src-tauri/src/platform.rs`).
 * Only whitelisted events with short props are accepted by the server, the device id is a random
 * UUID kept on this machine and hashed server side, and nothing is sent when the player turned it
 * off in Settings → Privacy. Plain functions (not composables) so they work from event listeners.
 */
interface Context {
  locale: () => string
  mc: () => string | undefined
}

let context: Context = { locale: () => 'en', mc: () => undefined }
/** unknown: consent not read yet (events wait in memory), on: send, off: drop everything. */
let state: 'unknown' | 'on' | 'off' = 'unknown'
let queue: { name: string, props?: Record<string, string | number> }[] = []
let timer: ReturnType<typeof setTimeout> | null = null

export function configureTelemetry(next: Context) {
  context = next
}

export function setTelemetryEnabled(value: boolean) {
  state = value ? 'on' : 'off'
  if (!value) queue = []
  else if (queue.length) timer ??= setTimeout(() => { void flushTelemetry() }, 1000)
}

export function telemetryEnabled() {
  return state === 'on'
}

export function track(name: string, props?: Record<string, string | number | undefined>) {
  if (state === 'off' || !import.meta.client) return
  const clean: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v !== undefined && v !== null && v !== '') clean[k] = typeof v === 'string' ? v.slice(0, 64) : v
  }
  queue.push({ name, props: clean })
  if (queue.length > 100) queue.shift()
  if (state !== 'on') return
  if (queue.length >= 20) void flushTelemetry()
  else timer ??= setTimeout(() => { void flushTelemetry() }, 4000)
}

export async function flushTelemetry() {
  if (timer) clearTimeout(timer)
  timer = null
  const events = queue.splice(0, 50)
  if (!events.length || state !== 'on') return
  try {
    await invoke('platform_track', { events, locale: context.locale(), mcVersion: context.mc() ?? null })
  } catch { /* telemetry never disturbs the player */ }
}

/** Files a categorized error report (the server scrubs paths, e-mails and tokens). */
export async function reportIssue(category: string, code?: string, message?: string, details?: Record<string, string | number | boolean>) {
  if (state !== 'on' || !import.meta.client) return
  try {
    await invoke('platform_report', {
      category, code: code ?? null, message: message ?? null, details: details ?? null,
      locale: context.locale(), mcVersion: context.mc() ?? null,
    })
  } catch { /* ignore */ }
}

/** Maps a launch failure to one of the platform's error categories. */
export function failureCategory(e: unknown): string {
  const code = errorCode(e)
  const msg = errorDetail(e).toLowerCase()
  if (code === 'disk_full') return 'disk_space'
  if (code === 'auth') return 'auth_failed'
  if (/java/.test(msg)) return /version|unsupported|incompatible|class file|major/.test(msg) ? 'java_incompatible' : 'java_missing'
  if (/forge|fabric|quilt|neoforge|loader/.test(msg)) return 'modloader_install_failed'
  if (/download|checksum|sha-?1|hash/.test(msg)) return 'download_failed'
  if (code === 'network' || code === 'http') return 'network_error'
  return 'other'
}
