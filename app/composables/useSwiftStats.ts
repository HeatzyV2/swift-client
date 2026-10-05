/**
 * Local player stats: launch speed (fastest start, last start), launches and the days played.
 * Kept in localStorage; nothing leaves the machine. "Launch time" is the time from pressing Play to the
 * game process being up, and only counts when no download happened in between (a cold install is not a fair record).
 */
interface Stats {
  launches: number
  best: number | null
  last: number | null
  days: string[]
}

const KEY = 'swift.stats.v1'
const empty = (): Stats => ({ launches: 0, best: null, last: null, days: [] })

function read(): Stats {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...empty(), ...JSON.parse(raw) }
  } catch { /* storage unavailable: start empty */ }
  return empty()
}

const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const useSwiftStats = () => {
  const stats = useState<Stats>('swift-stats', read)
  const started = useState<Record<string, number>>('swift-launch-t0', () => ({}))
  const cold = useState<Record<string, boolean>>('swift-launch-cold', () => ({}))

  const persist = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(stats.value))
    } catch { /* ignore */ }
  }

  /** Consecutive days played, ending today (or yesterday: the streak lives until the day is over). */
  const streak = computed(() => {
    const set = new Set(stats.value.days)
    const d = new Date()
    if (!set.has(dayKey(d))) d.setDate(d.getDate() - 1)
    let n = 0
    while (set.has(dayKey(d))) {
      n++
      d.setDate(d.getDate() - 1)
    }
    return n
  })

  function noteStart(id: string) {
    started.value = { ...started.value, [id]: performance.now() }
    cold.value = { ...cold.value, [id]: false }
    const today = dayKey()
    stats.value = {
      ...stats.value,
      launches: stats.value.launches + 1,
      days: stats.value.days.includes(today) ? stats.value.days : [...stats.value.days, today].slice(-120),
    }
    persist()
  }

  /** The launch had to download something: it will not count for the speed record. */
  function noteInstall(id: string) {
    if (id in started.value) cold.value = { ...cold.value, [id]: true }
  }

  /** The game process is up. Returns the launch time, or null when it does not count. */
  function noteRunning(id: string): { ms: number, record: boolean } | null {
    const t0 = started.value[id]
    if (t0 === undefined) return null
    const { [id]: _done, ...rest } = started.value
    started.value = rest
    if (cold.value[id]) return null
    const ms = Math.round(performance.now() - t0)
    const previous = stats.value.best
    const record = previous !== null && ms < previous
    stats.value = { ...stats.value, last: ms, best: previous === null || ms < previous ? ms : previous }
    persist()
    return { ms, record }
  }

  return { stats, streak, noteStart, noteInstall, noteRunning }
}
