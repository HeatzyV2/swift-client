import { invoke } from '@tauri-apps/api/core'
import type { PlayerSkin, SavedSkin } from '~/types/launcher'

export interface SkinSource {
  src: string
  model: 'classic' | 'slim'
}

interface DefaultSkin { name: string, model: 'classic' | 'slim', path: string | null, url: string | null }

const cache = new Map<string, Promise<SkinSource | null>>()
const defaults = new Map<string, Promise<SkinSource | null>>()

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

/** Java's UUID.hashCode(): Minecraft used its low bit to pick Alex over Steve. */
function prefersAlex(uuid: string): boolean {
  const hex = uuid.replace(/-/g, '')
  if (hex.length !== 32) return false
  const hilo = BigInt(`0x${hex.slice(0, 16)}`) ^ BigInt(`0x${hex.slice(16)}`)
  const hash = Number((hilo >> 32n) ^ (hilo & 0xffffffffn)) | 0
  return (hash & 1) === 1
}

/**
 * Minecraft's own default skin — taken from an installed game jar, or Mojang's
 * skin template when the game has never been installed.
 */
function defaultSkin(name: 'Steve' | 'Alex'): Promise<SkinSource | null> {
  let task = defaults.get(name)
  if (!task) {
    task = (async () => {
      try {
        const list = await invoke<DefaultSkin[]>('list_default_skins')
        const skin = list.find(d => d.name === name) ?? list.find(d => d.name === 'Steve')
        if (!skin) return null
        const src = skin.path
          ? await invoke<string>('read_image_data_url', { path: skin.path })
          : await invoke<string>('fetch_skin_data_url', { url: skin.url })
        return { src, model: skin.model }
      } catch {
        return null
      }
    })()
    defaults.set(name, task)
  }
  return task
}

/**
 * What the player model wears: the account's real skin, else Minecraft's
 * default Steve or Alex. `isDefault` marks the latter, which is never presented
 * as the player's own (no face in the header).
 */
export const usePlayerSkin = () => {
  const accounts = useAccountStore()
  const skin = ref<SkinSource | null>(null)
  const isDefault = ref(false)
  const loading = ref(true)

  watch(
    () => accounts.loaded ? (accounts.activeAccount ? `${accounts.activeAccount.kind}:${accounts.activeAccount.uuid}` : 'none') : null,
    async (key) => {
      if (!key) return
      const account = accounts.activeAccount
      loading.value = true
      let own: SkinSource | null = null
      if (account) {
        if (!cache.has(key)) cache.set(key, resolveSkin(account.uuid, account.kind))
        own = await cache.get(key)!
      }
      const fallback = own ? null : await defaultSkin(account && prefersAlex(account.uuid) ? 'Alex' : 'Steve')
      if (accounts.activeAccount?.uuid !== account?.uuid) return
      skin.value = own ?? fallback
      isDefault.value = !own
      loading.value = false
    },
    { immediate: true },
  )

  return { skin, isDefault, loading }
}
