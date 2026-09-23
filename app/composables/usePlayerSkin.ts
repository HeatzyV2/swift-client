import { invoke } from '@tauri-apps/api/core'
import type { PlayerSkin, SavedSkin } from '~/types/launcher'

export interface SkinSource {
  src: string
  model: 'classic' | 'slim'
}

interface DefaultSkin { name: string, model: 'classic' | 'slim', path: string | null, url: string | null }

const cache = new Map<string, Promise<SkinSource | null>>()

/**
 * The skin to show for the active account: the Microsoft profile skin, else the
 * skin marked active in the launcher, else Minecraft's default Steve (only once
 * the game has been installed at least once — the launcher does not ship it).
 */
async function resolveSkin(uuid: string, kind: 'microsoft' | 'offline'): Promise<SkinSource | null> {
  if (kind === 'microsoft') {
    try {
      const ps = await invoke<PlayerSkin>('get_player_skin', { uuid })
      return { src: ps.skin, model: ps.slim ? 'slim' : 'classic' }
    } catch { /* offline or rate limited: fall through to local skins */ }
  }
  try {
    const active = (await invoke<SavedSkin[]>('list_skins')).find(s => s.active)
    if (active) return { src: await invoke<string>('get_skin_data_url', { id: active.id }), model: active.model }
  } catch { /* no saved skins */ }
  try {
    const defaults = await invoke<DefaultSkin[]>('list_default_skins')
    const steve = defaults.find(d => d.name.toLowerCase() === 'steve' && d.path) ?? defaults.find(d => d.path)
    if (steve?.path) return { src: await invoke<string>('read_image_data_url', { path: steve.path }), model: steve.model }
  } catch { /* the game has never been installed */ }
  return null
}

export const usePlayerSkin = () => {
  const accounts = useAccountStore()
  const skin = ref<SkinSource | null>(null)
  const loading = ref(false)

  watch(
    () => accounts.activeAccount ? `${accounts.activeAccount.kind}:${accounts.activeAccount.uuid}` : null,
    async (key) => {
      const account = accounts.activeAccount
      if (!key || !account) {
        skin.value = null
        return
      }
      loading.value = true
      if (!cache.has(key)) cache.set(key, resolveSkin(account.uuid, account.kind))
      const resolved = await cache.get(key)!
      if (accounts.activeAccount?.uuid === account.uuid) skin.value = resolved
      loading.value = false
    },
    { immediate: true },
  )

  return { skin, loading }
}
