import { invoke } from '@tauri-apps/api/core'

const REFRESH_MS = 30_000
let started = false

/**
 * Swift players in game right now (the backend counts the mod's heartbeats). `null` without
 * an online service or while it does not answer. Refreshed every 30 s while the window is visible.
 */
export const usePlayersOnline = () => {
  const count = useState<number | null>('sw-players-online', () => null)

  async function refresh() {
    if (document.hidden) return
    count.value = await invoke<number | null>('swift_players_online').catch(() => null)
  }

  if (!started && import.meta.client) {
    started = true
    void refresh()
    setInterval(refresh, REFRESH_MS)
    document.addEventListener('visibilitychange', () => { if (!document.hidden) void refresh() })
  }

  return count
}
