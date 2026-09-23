import { HERO_BACKGROUNDS, HERO_FALLBACK, HERO_ROTATE_MS, type HeroBackground } from '~/content/media'

const decoded = new Map<string, Promise<void>>()

/** Loads and decodes an image once, so swapping to it never flashes. */
function preload(src: string): Promise<void> {
  let task = decoded.get(src)
  if (!task) {
    const img = new Image()
    img.src = src
    task = img.decode().catch(() => {})
    decoded.set(src, task)
  }
  return task
}

/**
 * Cycles the Home backgrounds from content/media.ts. The next image is decoded
 * before the swap, and the timer stops while the window is hidden.
 */
export const useHeroRotation = () => {
  const list: HeroBackground[] = HERO_BACKGROUNDS.length ? HERO_BACKGROUNDS : [HERO_FALLBACK]
  const index = ref(0)
  const current = computed(() => list[index.value] ?? HERO_FALLBACK)

  let timer: ReturnType<typeof setTimeout> | null = null

  async function goTo(next: number) {
    const target = ((next % list.length) + list.length) % list.length
    await preload(list[target]!.src)
    index.value = target
    schedule()
  }

  function schedule() {
    if (timer) clearTimeout(timer)
    timer = null
    if (list.length < 2 || document.hidden) return
    timer = setTimeout(() => goTo(index.value + 1), HERO_ROTATE_MS)
  }

  const onVisibility = () => schedule()

  onMounted(() => {
    preload(current.value.src)
    if (list.length > 1) preload(list[1]!.src)
    document.addEventListener('visibilitychange', onVisibility)
    schedule()
  })

  onBeforeUnmount(() => {
    if (timer) clearTimeout(timer)
    document.removeEventListener('visibilitychange', onVisibility)
  })

  return { list, index, current, goTo }
}
