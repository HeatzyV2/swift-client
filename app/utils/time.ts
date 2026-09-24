const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
]

/** "3 days ago", in the interface language. */
export function formatRelative(iso: string | null | undefined, locale: string): string | null {
  if (!iso) return null
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000
  if (!Number.isFinite(seconds)) return null
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit)
  }
  return rtf.format(0, 'minute')
}

/** "12 h 5 min" / "42 min", with the units of the interface language. Anything played counts as at least a minute. */
export function formatPlaytime(seconds: number, locale: string): string {
  const unit = (value: number, u: 'hour' | 'minute') =>
    new Intl.NumberFormat(locale, { style: 'unit', unit: u, unitDisplay: 'short' }).format(value)
  const total = Math.max(seconds > 0 ? 1 : 0, Math.floor(seconds / 60))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (!h) return unit(m, 'minute')
  return m ? `${unit(h, 'hour')} ${unit(m, 'minute')}` : unit(h, 'hour')
}
