import { invoke } from '@tauri-apps/api/core'
import type { ScreenshotInfo } from '~/types/launcher'

export const DEFAULT_BACKDROP = '/art/hero-default.svg'

const cache = new Map<string, Promise<string | null>>()

async function latestScreenshot(instanceId: string): Promise<string | null> {
  try {
    const shots = await invoke<ScreenshotInfo[]>('list_screenshots', { id: instanceId })
    const latest = [...shots].sort((a, b) => b.modified - a.modified)[0]
    return latest ? await thumbnailUrl(latest.path, 1600) : null
  } catch {
    return null
  }
}

/** The Hero background: the instance's newest screenshot, or Swift's own artwork. */
export const useHeroBackdrop = (instanceId: Ref<string | null | undefined>) => {
  const src = ref(DEFAULT_BACKDROP)
  const isScreenshot = ref(false)

  watch(instanceId, async (id) => {
    if (!id) {
      src.value = DEFAULT_BACKDROP
      isScreenshot.value = false
      return
    }
    if (!cache.has(id)) cache.set(id, latestScreenshot(id))
    const shot = await cache.get(id)!
    if (instanceId.value !== id) return
    src.value = shot ?? DEFAULT_BACKDROP
    isScreenshot.value = !!shot
  }, { immediate: true })

  return { src, isScreenshot }
}
