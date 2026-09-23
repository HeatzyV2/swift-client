import { invoke } from '@tauri-apps/api/core'

interface BackendStatus {
  configured: boolean
  accounts: boolean
  discord: boolean
}

let request: Promise<void> | null = null

/**
 * Whether this build talks to a Swift Client online service (see
 * `src-tauri/src/backend.rs`). Features that need it — CurseForge, sharing by
 * code — stay hidden when it is not configured.
 */
export const useBackend = () => {
  const status = useState<BackendStatus>('backend-status', () => ({ configured: false, accounts: false, discord: false }))

  request ??= invoke<BackendStatus>('backend_status')
    .then((s) => { status.value = s })
    .catch(() => {})

  return {
    ready: request,
    configured: computed(() => status.value.configured),
    accounts: computed(() => status.value.accounts),
    discord: computed(() => status.value.discord),
  }
}
