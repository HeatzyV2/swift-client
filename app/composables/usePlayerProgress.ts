export interface PlayerBadge {
  id: string
  emoji: string
  /** i18n key */
  label: string
  earned: boolean
}

/**
 * Level, XP and badges, all derived from what the launcher already knows: total playtime, the instances,
 * and the local launch stats. Level n starts at (n-1)²/2 hours, so the first levels come fast and the later ones slow down.
 */
export const usePlayerProgress = () => {
  const instances = useInstancesStore()
  const { stats, streak } = useSwiftStats()

  const totalSeconds = computed(() => instances.instances.reduce((sum, i) => sum + (i.playtime_seconds ?? 0), 0))
  const hours = computed(() => totalSeconds.value / 3600)
  const level = computed(() => Math.floor(Math.sqrt(2 * hours.value)) + 1)
  const progress = computed(() => {
    const lo = ((level.value - 1) ** 2) / 2
    const hi = (level.value ** 2) / 2
    return Math.max(0, Math.min(1, (hours.value - lo) / (hi - lo)))
  })

  const badges = computed<PlayerBadge[]>(() => {
    const best = stats.value.best
    const defs: [string, string, string, boolean][] = [
      ['first', '🎮', 'swiftx.badge.first', stats.value.launches >= 1 || totalSeconds.value > 0],
      ['ten', '⏱️', 'swiftx.badge.ten', hours.value >= 10],
      ['fifty', '🔥', 'swiftx.badge.fifty', hours.value >= 50],
      ['hundred', '👑', 'swiftx.badge.hundred', hours.value >= 100],
      ['streak3', '📅', 'swiftx.badge.streak3', streak.value >= 3],
      ['streak7', '🗓️', 'swiftx.badge.streak7', streak.value >= 7],
      ['builder', '🧩', 'swiftx.badge.builder', instances.instances.length >= 3],
      ['speedy', '⚡', 'swiftx.badge.speedy', best !== null && best < 10_000],
    ]
    return defs.map(([id, emoji, label, earned]) => ({ id, emoji, label, earned }))
  })

  return { totalSeconds, hours, level, progress, badges, streak, stats }
}
