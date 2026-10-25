export interface AppError { code: string, message: string }

const CODES = new Set([
  'network', 'http', 'not_found', 'permission', 'disk_full',
  'io', 'invalid', 'auth', 'busy', 'panic', 'backend_unavailable', 'session_expired', 'unknown',
])

export function errorCode(e: unknown): string {
  const code = (e as AppError | null)?.code
  return typeof code === 'string' && CODES.has(code) ? code : 'unknown'
}

export function errorDetail(e: unknown): string {
  if (typeof e === 'string') return e
  const message = (e as AppError | null)?.message
  if (typeof message === 'string') return message
  return e instanceof Error ? e.message : errorText(e)
}

export function errorText(e: unknown): string {
  const detail = errorDetail(e)
  const code = errorCode(e)
  if (code === 'unknown') return detail

  try {
    const t = useNuxtApp().$i18n?.t
    if (typeof t === 'function') {
      const label = t(`errors.${code}`)
      // An expired session needs no technical detail: the label says what to do
      if (label && label !== `errors.${code}`) return code === 'session_expired' ? label : `${label} — ${detail}`
    }
  } catch {
  }
  return detail
}
