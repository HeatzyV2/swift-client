import { invoke } from '@tauri-apps/api/core'
import type { QuickPlay } from '~/types/launcher'

interface PendingLaunch {
  instanceId: string
  quickPlay?: QuickPlay
  warnings: string[]
}

/**
 * The one way the UI starts Minecraft: checks for an account, collects
 * pre-launch warnings (RAM, mod conflicts, Essential, …) and asks before
 * going ahead when there are any. `PrelaunchModal` renders the confirmation.
 */
export const useLaunchFlow = () => {
  const instances = useInstancesStore()
  const accounts = useAccountStore()
  const sysMem = useSystemMemory()
  const mc = useMinecraftLaunch()
  const dash = useLaunchDash()
  const swiftStats = useSwiftStats()
  const toast = useToast()
  const { t, te } = useI18n()

  const pending = useState<PendingLaunch | null>('launch-flow-pending', () => null)

  async function collectWarnings(instanceId: string): Promise<string[]> {
    const out: string[] = []
    const inst = instances.instances.find(i => i.id === instanceId)
    if (!inst) return out
    await sysMem.ensure()
    if (inst.override_memory && inst.memory_mb && sysMem.totalMb.value && inst.memory_mb > sysMem.totalMb.value * 0.9) {
      out.push(t('prelaunch.ramHigh', { mb: inst.memory_mb }))
    }
    try {
      const conflicts = await invoke<{ name: string, kind: string, detail: string }[]>('check_conflicts', { instanceId })
      for (const c of conflicts) {
        out.push(c.kind === 'loader' ? t('prelaunch.conflict', { name: c.name, detail: c.detail }) : t('prelaunch.duplicate', { name: c.name }))
      }
    } catch { /* conflict check is advisory */ }
    try {
      const hints = await invoke<{ kind: string }[]>('prelaunch_checks', { instanceId })
      for (const h of hints) {
        const key = `prelaunch.${h.kind}`
        out.push(te(key) ? t(key) : h.kind)
      }
    } catch { /* advisory */ }
    return out
  }

  function start(instanceId: string, quickPlay?: QuickPlay) {
    // Best-effort: install/refresh Swift client mod before launch path runs again.
    invoke('ensure_client_mod', { instanceId }).catch(() => {})
    dash.trigger()
    swiftStats.noteStart(instanceId)
    const inst = instances.instances.find(i => i.id === instanceId)
    track('launch_game', { mcVersion: inst?.mc_version, loader: inst?.loader.type })
    mc.launch(instanceId, quickPlay).catch(() => { /* surfaced through mc.error */ })
  }

  /** Resolves to true when the game was actually started (false: no account, or waiting for confirmation). */
  async function play(instanceId: string, quickPlay?: QuickPlay): Promise<boolean> {
    await accounts.ensureLoaded()
    if (!accounts.activeAccount) {
      toast.add({ title: t('prelaunch.noAccount'), color: 'error', icon: 'i-lucide-user-x' })
      return false
    }
    const warnings = await collectWarnings(instanceId)
    if (warnings.length) {
      pending.value = { instanceId, quickPlay, warnings }
      return false
    }
    start(instanceId, quickPlay)
    return true
  }

  function confirm() {
    const p = pending.value
    pending.value = null
    if (p) start(p.instanceId, p.quickPlay)
  }

  function cancel() {
    pending.value = null
  }

  return { pending, play, confirm, cancel }
}
