<template>
  <section
    ref="root"
    class="relative isolate h-[clamp(480px,68vh,740px)] overflow-hidden rounded-[24px] border border-white/[0.06] bg-[var(--sw-canvas)]"
    @mousemove="onMove"
    @mouseleave="onLeave"
  >
    <!-- Background — follows the cursor slightly -->
    <img
      :src="rotation.current.value.src"
      alt=""
      draggable="false"
      class="pointer-events-none absolute inset-[-4%] size-[108%] max-w-none object-cover blur-[1px] brightness-[0.95] will-change-transform"
      :class="reduceMotion ? '' : 'transition-transform duration-500 ease-out'"
      :style="{
        objectPosition: rotation.current.value.position ?? '50% 50%',
        transform: `translate3d(${parallax.x}px, ${parallax.y}px, 0)`,
      }"
    >

    <div class="pointer-events-none absolute inset-0 bg-[rgb(0_0_0/0.22)]" />
    <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,transparent_28%,rgb(0_0_0/0.55)_100%)]" />
    <div class="pointer-events-none absolute inset-x-0 bottom-0 h-[58%] bg-[linear-gradient(to_top,rgb(0_0_0/0.88)_0%,rgb(0_0_0/0.35)_42%,transparent_100%)]" />

    <!-- Selected instance, top left -->
    <Transition name="sw-rise" mode="out-in">
      <div
        v-if="instance"
        :key="instance.id"
        class="absolute left-6 top-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-3 py-2.5 backdrop-blur-md"
      >
        <InstanceIcon :instance="instance" class="size-9 rounded-lg text-sm shadow-[0_4px_16px_rgb(0_0_0/0.4)]" />
        <div class="min-w-0">
          <p class="truncate font-display text-[14px] font-semibold text-white">{{ instance.name }}</p>
          <p class="text-[11px] text-white/60">
            {{ lastPlayed ? $t('home.playedAgo', { when: lastPlayed }) : $t('instance.neverPlayed') }}
          </p>
        </div>
      </div>
    </Transition>

    <!-- Player and play control, centred -->
    <div class="absolute inset-0 flex flex-col items-center justify-end px-6 pb-[5%]">
      <div class="pointer-events-none relative flex h-[64%] min-h-0 w-full flex-col items-center justify-end">
        <Transition name="sw-rise" mode="out-in">
          <div v-if="playerImage" :key="playerImage" class="flex h-full w-full flex-col items-center justify-end">
            <span
              v-if="accounts.activeAccount"
              class="mb-3 rounded-md bg-black/70 px-3 py-1 font-mono text-[14px] font-medium tracking-wide text-white shadow-[0_4px_20px_rgb(0_0_0/0.45)]"
            >{{ accounts.activeAccount.username }}</span>
            <img
              :src="playerImage"
              alt=""
              draggable="false"
              class="-mb-[5%] min-h-0 w-auto flex-1 object-contain object-bottom drop-shadow-[0_24px_40px_rgb(0_0_0/0.6)]"
            >
          </div>
        </Transition>
      </div>

      <HomePlayControl :instance="instance" class="relative z-10" />
    </div>
  </section>
</template>

<script setup lang="ts">
import type { Instance } from '~/types/launcher'

const props = defineProps<{ instance?: Instance }>()

const accounts = useAccountStore()
const { locale } = useI18n()

const rotation = useHeroRotation()
const { skin } = usePlayerSkin()
const playerImage = usePlayerRender(skin)

const lastPlayed = computed(() => formatRelative(props.instance?.last_played, locale.value))

const root = ref<HTMLElement | null>(null)
const parallax = reactive({ x: 0, y: 0 })
const reduceMotion = ref(false)

/** Max shift in px — subtle depth, not a full slide. */
const RANGE = 18

function onMove(e: MouseEvent) {
  if (reduceMotion.value || !root.value) return
  const rect = root.value.getBoundingClientRect()
  const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
  const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1
  parallax.x = nx * RANGE
  parallax.y = ny * RANGE
}

function onLeave() {
  parallax.x = 0
  parallax.y = 0
}

onMounted(() => {
  reduceMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
})
</script>
