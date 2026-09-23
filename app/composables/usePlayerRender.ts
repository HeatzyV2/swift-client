import { toValue, type MaybeRefOrGetter } from 'vue'
import type { SkinSource } from './usePlayerSkin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let viewerPromise: Promise<any> | null = null
let queue: Promise<unknown> = Promise.resolve()
const rendered = new Map<string, Promise<string>>()

const WIDTH = 420
const HEIGHT = 640

async function getViewer() {
  viewerPromise ??= (async () => {
    const { SkinViewer } = await import('skinview3d')
    const canvas = document.createElement('canvas')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v: any = new SkinViewer({ canvas, width: WIDTH, height: HEIGHT, renderPaused: true, zoom: 0.92 })
    v.fov = 38
    v.playerObject.cape.visible = false
    v.playerObject.elytra.visible = false
    v.playerObject.rotation.y = -0.42
    const skin = v.playerObject.skin
    skin.rightArm.rotation.x = -0.28
    skin.leftArm.rotation.x = 0.22
    skin.rightLeg.rotation.x = 0.16
    skin.leftLeg.rotation.x = -0.16
    v.globalLight.intensity = 3
    v.cameraLight.intensity = 0.6
    return v
  })()
  return viewerPromise
}

/**
 * Renders a full-body pose of a skin once, to a PNG data URL. One hidden WebGL
 * canvas is shared and no render loop runs, so the Home stays cheap.
 */
export function renderPlayer(skin: SkinSource): Promise<string> {
  const key = `${skin.model}:${skin.src.length}:${skin.src.slice(-64)}`
  const cached = rendered.get(key)
  if (cached) return cached
  const task = queue.then(async () => {
    const v = await getViewer()
    await v.loadSkin(skin.src, { model: skin.model === 'slim' ? 'slim' : 'default' })
    v.render()
    return v.canvas.toDataURL('image/png') as string
  })
  queue = task.catch(() => {})
  rendered.set(key, task)
  return task
}

export const usePlayerRender = (skin: MaybeRefOrGetter<SkinSource | null>) => {
  const image = ref<string | null>(null)
  watch(() => toValue(skin), async (s) => {
    if (!s) {
      image.value = null
      return
    }
    try {
      image.value = await renderPlayer(s)
    } catch {
      image.value = null
    }
  }, { immediate: true })
  return image
}
