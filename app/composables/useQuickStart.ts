import type { Instance } from '~/types/launcher'

/**
 * First launch in one click: creates the recommended Swift Client instance
 * (Fabric + the Swift mod + Fabric API) and starts it. When the Swift mod is
 * not bundled (dev builds), it falls back to the latest Vanilla release.
 */
export const useQuickStart = () => {
  const busy = useState('sw-quick-start-busy', () => false)
  const instances = useInstancesStore()
  const launchFlow = useLaunchFlow()
  const meta = useMinecraftMeta()

  async function createInstance(): Promise<Instance> {
    try {
      return await instances.createSwift()
    } catch {
      const latest = (await meta.getMinecraftVersions(false))[0]
      if (!latest) throw new Error('no Minecraft release available')
      return await instances.create({ name: `Minecraft ${latest.id}`, mcVersion: latest.id, loader: { type: 'vanilla' } })
    }
  }

  async function start() {
    if (busy.value) return
    busy.value = true
    try {
      const instance = await createInstance()
      await launchFlow.play(instance.id)
    } finally {
      busy.value = false
    }
  }

  return { busy, start }
}
