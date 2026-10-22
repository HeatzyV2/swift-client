import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { UnlistenFn } from '@tauri-apps/api/event'
import type { ModUpdateStatus } from '~/types/launcher'

/**
 * The Swift Client mod as the launcher manages it: which version will run, whether a newer one is out on
 * the player's channel, the progress of a download, and the versions kept for rolling back.
 * One shared state for the whole app; `attach()` (called once from app.vue) follows the background updater.
 */
export const useSwiftMod = () => {
  const status = useState<ModUpdateStatus | null>('sw-mod-status', () => null)
  const progress = useState<{ received: number, total: number, version: string } | null>('sw-mod-progress', () => null)
  const busy = useState('sw-mod-busy', () => false)
  const error = useState<string | null>('sw-mod-error', () => null)

  const percent = computed(() => {
    const p = progress.value
    return p && p.total > 0 ? Math.min(100, Math.round((p.received / p.total) * 100)) : 0
  })

  async function refresh() {
    try {
      status.value = await invoke<ModUpdateStatus>('mod_update_status')
    } catch (e) {
      error.value = errorText(e)
    }
  }

  async function run(command: string, args?: Record<string, unknown>) {
    busy.value = true
    error.value = null
    try {
      status.value = await invoke<ModUpdateStatus>(command, args)
    } catch (e) {
      error.value = errorText(e)
      throw e
    } finally {
      busy.value = false
      progress.value = null
    }
  }

  /** Asks GitHub whether a newer mod exists on the player's channel. */
  const check = () => run('mod_update_check')
  /** Downloads the newest mod now (leaves a pinned version behind). */
  const install = () => run('mod_update_install')
  const useVersion = (version: string) => run('mod_use_version', { version })
  const unpin = () => run('mod_unpin')

  let unlisteners: UnlistenFn[] = []
  async function attach() {
    const { t } = useNuxtApp().$i18n as { t: (key: string, params?: Record<string, unknown>) => string }
    const toast = useToast()
    unlisteners.push(await listen<{ received: number, total: number, version: string }>('mod-update-progress', (e) => {
      progress.value = e.payload
    }))
    unlisteners.push(await listen<{ version: string }>('mod-update-done', async (e) => {
      progress.value = null
      await refresh()
      toast.add({
        title: t('swiftMod.updatedToast', { version: e.payload.version }),
        description: t('swiftMod.updatedToastDesc'),
        icon: 'i-lucide-download',
        color: 'success',
      })
    }))
    refresh()
  }

  function detach() {
    for (const off of unlisteners) off()
    unlisteners = []
  }

  return { status, progress, percent, busy, error, refresh, check, install, useVersion, unpin, attach, detach }
}
