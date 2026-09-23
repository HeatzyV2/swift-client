import { invoke } from '@tauri-apps/api/core'
import type { QuickPlay } from '~/types/launcher'

interface PendingLaunch {
  instanceId: string
  quickPlay?: QuickPlay
  warnings: string[]
}

/**
 * The one way the UI starts Minecraft: checks for an account, collects
 * pre-launch warnings (RAM, mod conflicts) and asks before going ahead when
 * there are any. `PrelaunchModal` renders the confirmation.
 */
export const useLaunchFlow = () => {
  const instances = useInstancesStore()
  const accounts = useAccountStore()
  const sysMem = useSystemMemory()
  const mc = useMinecraftLaunch()
  const toast = useToast()
  const { t } = useI18n()

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
    return out
  }

  function start(instanceId: string, quickPlay?: QuickPlay) {
    mc.launch(instanceId, quickPlay).catch(() => { /* surfaced through mc.error */ })
  }

  async function play(instanceId: string, quickPlay?: QuickPlay) {
    await accounts.ensureLoaded()
    if (!accounts.activeAccount) {
      toast.add({ title: t('prelaunch.noAccount'), color: 'error', icon: 'i-lucide-user-x' })
      return
    }
    const warnings = await collectWarnings(instanceId)
    if (warnings.length) {
      pending.value = { instanceId, quickPlay, warnings }
      return
    }
    start(instanceId, quickPlay)
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
