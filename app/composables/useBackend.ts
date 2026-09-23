import { invoke } from '@tauri-apps/api/core'

export interface SwiftSession {
  token: string
  user_id: string
  username: string
  mc_uuid?: string | null
  mc_username?: string | null
}

interface BackendStatus {
  configured: boolean
  accounts: boolean
  discord: boolean
}

let request: Promise<void> | null = null

/**
 * Whether this build talks to a Swift Client online service (see
 * `src-tauri/src/backend.rs`). Features that need it — CurseForge, sharing by
 * code, remote Social — stay gated when it is not configured.
 */
export const useBackend = () => {
  const status = useState<BackendStatus>('backend-status', () => ({ configured: false, accounts: false, discord: false }))
  const session = useState<SwiftSession | null>('swift-session', () => null)

  async function refresh() {
    try {
      status.value = await invoke<BackendStatus>('backend_status')
      session.value = await invoke<SwiftSession | null>('swift_session')
      status.value = { ...status.value, accounts: !!session.value }
    } catch {
      /* ignore */
    }
  }

  request ??= refresh()

  async function register(username: string, password: string) {
    const s = await invoke<SwiftSession>('swift_register', { args: { username, password } })
    session.value = s
    status.value = { ...status.value, accounts: true }
    return s
  }

  async function login(username: string, password: string) {
    const s = await invoke<SwiftSession>('swift_login', { args: { username, password } })
    session.value = s
    status.value = { ...status.value, accounts: true }
    return s
  }

  async function logout() {
    await invoke('swift_logout')
    session.value = null
    status.value = { ...status.value, accounts: false }
  }

  async function linkMinecraft() {
    const s = await invoke<SwiftSession>('swift_link_minecraft')
    session.value = s
    return s
  }

  return {
    ready: request,
    refresh,
    configured: computed(() => status.value.configured),
    accounts: computed(() => status.value.accounts || !!session.value),
    discord: computed(() => status.value.discord),
    session: computed(() => session.value),
    register,
    login,
    logout,
    linkMinecraft,
  }
}
