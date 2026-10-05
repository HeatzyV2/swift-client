import type { Instance } from '~/types/launcher'

/** Marker flag: lets the launcher recognise (and undo) its own Boost without touching the player's own arguments. */
const MARKER = '-Dswift.boost=1'
const FLAGS = [
  MARKER,
  '-XX:+UseG1GC',
  '-XX:+ParallelRefProcEnabled',
  '-XX:MaxGCPauseMillis=130',
  '-XX:+UnlockExperimentalVMOptions',
  '-XX:+DisableExplicitGC',
  '-XX:G1NewSizePercent=30',
  '-XX:G1MaxNewSizePercent=40',
  '-XX:G1HeapRegionSize=8M',
  '-XX:G1ReservePercent=20',
]

interface Previous {
  override_memory: boolean
  memory_mb: number | null | undefined
  override_java_args: boolean
  java_args: string[]
}

const prevKey = (id: string) => `swift.boost.prev.${id}`

/**
 * One-click performance preset for an instance: memory sized to this PC (about 40 % of it, between 2 and 8 GB)
 * and a smoother set of G1 garbage-collector flags. Switching it off restores what the player had before.
 */
export const useBoost = (instance: Ref<Instance | undefined> | ComputedRef<Instance | undefined>) => {
  const instances = useInstancesStore()
  const sysMem = useSystemMemory()
  const toast = useToast()
  const { t } = useI18n()

  const boosted = computed(() => !!instance.value?.override_java_args && !!instance.value?.java_args?.includes(MARKER))

  async function toggle() {
    const inst = instance.value
    if (!inst) return
    await sysMem.ensure()
    const next: Instance = { ...inst }
    if (boosted.value) {
      let prev: Previous | null = null
      try {
        prev = JSON.parse(localStorage.getItem(prevKey(inst.id)) ?? 'null')
        localStorage.removeItem(prevKey(inst.id))
      } catch { /* no saved state */ }
      next.override_memory = prev?.override_memory ?? false
      next.memory_mb = prev?.memory_mb ?? null
      next.override_java_args = prev?.override_java_args ?? false
      next.java_args = prev?.java_args ?? inst.java_args.filter(a => !FLAGS.includes(a))
      await instances.update(next)
      toast.add({ title: t('swiftx.boost.removed'), icon: 'i-pixelarticons-zap-off' })
      return
    }
    const prev: Previous = {
      override_memory: inst.override_memory,
      memory_mb: inst.memory_mb,
      override_java_args: inst.override_java_args,
      java_args: [...inst.java_args],
    }
    try {
      localStorage.setItem(prevKey(inst.id), JSON.stringify(prev))
    } catch { /* ignore */ }
    const total = sysMem.totalMb.value || 8192
    const mb = Math.max(2048, Math.min(8192, Math.round((total * 0.4) / 512) * 512))
    next.override_memory = true
    next.memory_mb = mb
    next.override_java_args = true
    next.java_args = [...inst.java_args.filter(a => !FLAGS.includes(a)), ...FLAGS]
    await instances.update(next)
    toast.add({ title: t('swiftx.boost.applied', { gb: (mb / 1024).toFixed(mb % 1024 ? 1 : 0) }), icon: 'i-pixelarticons-zap', color: 'success' })
  }

  return { boosted, toggle }
}
