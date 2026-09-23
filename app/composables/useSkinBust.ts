/**
 * Renders a full-body skin thumbnail as a PNG data URL.
 * One hidden WebGL canvas is shared; no render loop runs.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let viewerPromise: Promise<any> | null = null
let queue: Promise<unknown> = Promise.resolve()

const WIDTH = 120
const HEIGHT = 200

async function getThumbViewer() {
  if (!viewerPromise) {
    viewerPromise = (async () => {
      const { SkinViewer } = await import('skinview3d')
      const canvas = document.createElement('canvas')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v: any = new SkinViewer({
        canvas,
        width: WIDTH,
        height: HEIGHT,
        renderPaused: true,
        zoom: 0.9,
      })
      v.fov = 38
      v.playerObject.cape.visible = false
      v.playerObject.elytra.visible = false
      v.playerObject.rotation.y = -0.35
      const skin = v.playerObject.skin
      skin.rightArm.rotation.x = -0.2
      skin.leftArm.rotation.x = 0.16
      skin.rightLeg.rotation.x = 0.12
      skin.leftLeg.rotation.x = -0.12
      v.globalLight.intensity = 2.8
      v.cameraLight.intensity = 0.55
      return v
    })()
  }
  return viewerPromise
}

export function useSkinBust() {
  function render(source: string, model: 'classic' | 'slim'): Promise<string> {
    const task = queue.then(async () => {
      const v = await getThumbViewer()
      await v.loadSkin(source, { model: model === 'slim' ? 'slim' : 'default' })
      v.render()
      return v.canvas.toDataURL('image/png') as string
    })
    queue = task.catch(() => {})
    return task
  }

  return { render }
}
