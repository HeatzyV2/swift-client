import { invoke } from '@tauri-apps/api/core'
import { DEFAULT_SKIN } from '~/content/media'
import type { PlayerSkin, SavedSkin } from '~/types/launcher'

export interface SkinSource {
  src: string
  model: 'classic' | 'slim'
}

const cache = new Map<string, Promise<SkinSource | null>>()

/**
 * The real skin of the active account: the Microsoft profile skin, else the
 * skin marked active on the Skins page. `null` when there is none.
 */
async function resolveSkin(uuid: string, kind: 'microsoft' | 'offline'): Promise<SkinSource | null> {
  if (kind === 'microsoft') {
    try {
      const ps = await invoke<PlayerSkin>('get_player_skin', { uuid })
      return { src: ps.skin, model: ps.slim ? 'slim' : 'classic' }
    } catch { /* offline or rate limited: try the local skin */ }
  }
  try {
    const active = (await invoke<SavedSkin[]>('list_skins')).find(s => s.active)
    if (active) return { src: await invoke<string>('get_skin_data_url', { id: active.id }), model: active.model }
  } catch { /* no saved skins */ }
  return null
}

/**
 * What the player model wears. `isDefault` is true when no real skin exists and
 * Swift's fallback skin is shown instead — never presented as the player's own.
 */
export const usePlayerSkin = () => {
  const accounts = useAccountStore()
  const own = ref<SkinSource | null>(null)
  const loading = ref(true)

  watch(
    () => accounts.activeAccount ? `${accounts.activeAccount.kind}:${accounts.activeAccount.uuid}` : null,
    async (key) => {
      const account = accounts.activeAccount
      if (!key || !account) {
        own.value = null
        loading.value = !accounts.loaded
        return
      }
      loading.value = true
      if (!cache.has(key)) cache.set(key, resolveSkin(account.uuid, account.kind))
      const resolved = await cache.get(key)!
      if (accounts.activeAccount?.uuid !== account.uuid) return
      own.value = resolved
      loading.value = false
    },
    { immediate: true },
  )

  watch(() => accounts.loaded, (loaded) => {
    if (loaded && !accounts.activeAccount) loading.value = false
  })

  const skin = computed<SkinSource | null>(() => (loading.value ? null : own.value ?? DEFAULT_SKIN))
  const isDefault = computed(() => !loading.value && !own.value)

  return { skin, isDefault, loading }
}
