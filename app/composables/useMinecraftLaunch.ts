import { invoke } from '@tauri-apps/api/core'
import { toValue, type MaybeRefOrGetter } from 'vue'
import type { QuickPlay } from '~/types/launcher'

export type LaunchStage = 'idle' | 'launching' | 'installing' | 'running'

export const useMinecraftLaunch = (instanceId?: MaybeRefOrGetter<string | undefined>) => {
  const ac = useActivityCenter()
  const instances = useInstancesStore()

  const launchingIds = useState<Record<string, boolean>>('mc-launching-ids', () => ({}))
  const errors = useState<Record<string, string | null>>('mc-errors', () => ({}))

  const id = computed(() => toValue(instanceId))

  const activity = computed(() => (id.value ? ac.activityFor(id.value).value : ac.top.value))
  const launching = computed(() => (id.value ? !!launchingIds.value[id.value] : Object.values(launchingIds.value).some(Boolean)))

  // launching: checks and preparation before any download; installing: the
  // engine reports file progress; running: the game process is alive.
  const stage = computed<LaunchStage>(() => {
    const a = activity.value
    if (a?.kind === 'running') return 'running'
    if (a?.kind === 'install') return 'installing'
    return launching.value ? 'launching' : 'idle'
  })

  const progress = computed(() => {
    const a = activity.value
    return a && a.kind === 'install'
      ? { current: a.current, total: a.total, step: a.step ?? null }
      : { current: 0, total: 0, step: null }
  })

  const log = computed(() => (id.value ? ac.logsFor(id.value).value : []))
  const error = computed(() => (id.value ? errors.value[id.value] ?? null : null))

  const runningId = computed(() => ac.list.value.find(a => a.kind === 'running')?.instanceId ?? null)

  const launch = async (launchId: string, quickPlay?: QuickPlay) => {
    errors.value = { ...errors.value, [launchId]: null }
    ac.clearLog(launchId)
    launchingIds.value = { ...launchingIds.value, [launchId]: true }
    const inst = instances.instances.find(i => i.id === launchId)
    if (inst) inst.last_played = new Date().toISOString()
    instances.select(launchId)
    await ac.attach()
    try {
      await invoke('launch_instance', { id: launchId, quickPlay: quickPlay ?? null })
      // The command returns once the process is spawned. It may already have
      // exited (mc://exited then cleared the activity), so ask before marking it.
      if (await invoke<boolean>('is_instance_running', { id: launchId }).catch(() => false)) {
        ac.setRunning(launchId)
      }
      instances.load()
    } catch (e) {
      errors.value = { ...errors.value, [launchId]: errorText(e) }
      ac.clear(launchId)
      throw e
    } finally {
      launchingIds.value = { ...launchingIds.value, [launchId]: false }
    }
  }

  const clearError = (clearId: string) => {
    errors.value = { ...errors.value, [clearId]: null }
  }

  return {
    launching,
    runningId,
    stage,
    progress,
    log,
    error,
    launch,
    clearError,
    attach: ac.attach,
    detach: ac.detach,
  }
}
