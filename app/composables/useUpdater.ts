import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

/** The update found by the last check, shared by the startup check and Settings. */
let pending: Update | null = null

/**
 * Launcher self-update. Checked once shortly after start-up (see
 * plugins/updater.client.ts) and on demand from Settings → Updates.
 */
export const useUpdater = () => {
  const available = useState('sw-update-available', () => false)
  const version = useState('sw-update-version', () => '')
  const error = useState<string | null>('sw-update-error', () => null)
  const busy = useState('sw-update-busy', () => false)

  const ac = useActivityCenter()
  /** Installing restarts the launcher: never while a game runs or files download. */
  const blocked = computed(() => ac.list.value.length > 0)

  /** Returns true when an update is available. Throws only when `silent` is false. */
  async function checkForUpdate({ silent = false } = {}): Promise<boolean> {
    busy.value = true
    error.value = null
    try {
      pending = await check()
      available.value = !!pending
      version.value = pending?.version ?? ''
      return available.value
    } catch (e) {
      available.value = false
      error.value = errorText(e)
      if (!silent) throw e
      return false
    } finally {
      busy.value = false
    }
  }

  async function install() {
    if (!pending || blocked.value) return
    busy.value = true
    try {
      await pending.downloadAndInstall()
      await relaunch()
    } finally {
      busy.value = false
    }
  }

  return { available, version, error, busy, blocked, checkForUpdate, install }
}
