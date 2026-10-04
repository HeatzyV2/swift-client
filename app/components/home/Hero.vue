<template>
  <section
    ref="root"
    class="relative isolate h-[clamp(300px,44vh,440px)] overflow-hidden rounded-[6px] border-[3px] border-[var(--sw-ink)] bg-[var(--sw-canvas)] shadow-[0_0_0_2px_var(--sw-line-strong),0_8px_0_2px_var(--sw-block-side)]"
    @mousemove="onMove"
    @mouseleave="onLeave"
  >
    <!-- Background — follows the cursor slightly -->
    <img
      :src="rotation.current.value.src"
      alt=""
      draggable="false"
      class="pointer-events-none absolute inset-[-4%] size-[108%] max-w-none object-cover [image-rendering:pixelated] will-change-transform"
      :class="reduceMotion ? '' : 'transition-transform duration-500 ease-out'"
      :style="{
        objectPosition: rotation.current.value.position ?? '50% 50%',
        transform: `translate3d(${parallax.x}px, ${parallax.y}px, 0)`,
      }"
    >

    <!-- Flat dim, then a stepped dark floor under the play area: bands, never a soft fade -->
    <div class="pointer-events-none absolute inset-0 bg-[rgb(0_0_0/0.28)]" />
    <div class="sw-hero-floor pointer-events-none absolute inset-x-0 bottom-0 h-[46%]" />

    <!-- Selected instance, top left -->
    <Transition name="sw-rise" mode="out-in">
      <div
        v-if="instance"
        :key="instance.id"
        class="sw-block absolute left-5 top-5 flex items-center gap-3 px-3 py-2.5"
      >
        <InstanceIcon :instance="instance" class="size-9 rounded-[3px] border-2 border-[var(--sw-ink)] text-sm" />
        <div class="min-w-0">
          <p class="truncate font-display text-[16px] font-semibold text-white">{{ instance.name }}</p>
          <p class="text-[11px] text-muted">
            {{ lastPlayed ? $t('home.playedAgo', { when: lastPlayed }) : $t('instance.neverPlayed') }}
          </p>
        </div>
      </div>
    </Transition>

    <!-- Play control, centred at the bottom of the scene -->
    <div class="absolute inset-x-0 bottom-0 flex justify-center px-6 pb-[6%]">
      <HomePlayControl :instance="instance" class="relative z-10" />
    </div>
  </section>
</template>

<script setup lang="ts">
import type { Instance } from '~/types/launcher'

const props = defineProps<{ instance?: Instance }>()

const { locale } = useI18n()

const rotation = useHeroRotation()

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

<style scoped>
.sw-hero-floor {
  /* Four flat bands, darkest at the bottom: stops are hard, and it does not repeat */
  background: linear-gradient(
    to top,
    rgb(0 0 0 / 0.5) 0 25%,
    rgb(0 0 0 / 0.34) 25% 50%,
    rgb(0 0 0 / 0.18) 50% 75%,
    rgb(0 0 0 / 0.08) 75% 100%
  );
}
</style>
