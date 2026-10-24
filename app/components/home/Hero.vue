<template>
  <section
    ref="root"
    class="relative isolate flex min-h-[clamp(500px,66vh,660px)] flex-col overflow-hidden rounded-[22px] border border-[var(--sw-line)] bg-[var(--sw-canvas)] shadow-xl"
    @mousemove="onMove"
    @mouseleave="onLeave"
  >
    <!-- Background — follows the cursor slightly -->
    <img
      :src="rotation.current.value.src"
      alt=""
      draggable="false"
      class="pointer-events-none absolute inset-[-4%] size-[108%] max-w-none object-cover will-change-transform"
      :class="reduceMotion ? '' : 'transition-transform duration-700 ease-out'"
      :style="{
        objectPosition: rotation.current.value.position ?? '50% 50%',
        transform: `translate3d(${parallax.x}px, ${parallax.y}px, 0)`,
      }"
    >

    <!-- Navy wash with the Swift glow, a faint block grid, and a dark floor under the dock -->
    <div class="sw-scene pointer-events-none absolute inset-0 opacity-[0.86]" />
    <div class="sw-scene-grid pointer-events-none absolute inset-x-0 bottom-0 h-[55%]" />
    <div class="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgb(5_7_11/0.85)_0%,rgb(5_7_11/0.35)_45%,transparent_75%)]" />
    <div class="pointer-events-none absolute inset-x-0 bottom-0 h-[45%] bg-[linear-gradient(to_top,rgb(5_7_11/0.9),transparent)]" />

    <!-- Player card, floating on the right of the scene -->
    <div class="absolute right-8 top-8 z-10 w-[280px] max-lg:hidden">
      <HomeAvatarCard part="identity" />
    </div>

    <!-- Headline: the selected instance -->
    <Transition name="sw-rise" mode="out-in">
      <div v-if="instance" :key="instance.id" class="relative flex max-w-[620px] flex-col gap-3 px-10 pt-10">
        <span class="w-fit rounded-[8px] bg-primary px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] sw-on-accent shadow-[0_0_20px_color-mix(in_srgb,var(--sw-accent)_60%,transparent)]">
          {{ loaderLabel(instance.loader.type) }} {{ instance.mc_version }}
        </span>
        <h1 class="text-[clamp(34px,4.4vw,52px)] font-extrabold leading-[1.04] tracking-[-0.03em] text-white">{{ instance.name }}</h1>
        <p class="text-[15px] text-[#c3cad6]">
          {{ lastPlayed ? $t('home.playedAgo', { when: lastPlayed }) : $t('instance.neverPlayed') }}
        </p>
        <NuxtLink to="/instances" class="w-fit text-[14px] font-semibold text-[#8fb8ff] transition-colors hover:text-white">
          {{ $t('home.manageInstances') }} →
        </NuxtLink>
      </div>
      <div v-else class="relative flex max-w-[620px] flex-col gap-3 px-10 pt-10">
        <h1 class="text-[clamp(30px,3.8vw,46px)] font-extrabold leading-[1.06] tracking-[-0.03em] text-white">{{ $t('home.quickStart.hint') }}</h1>
      </div>
    </Transition>

    <div class="flex-1" />

    <!-- Play dock along the bottom of the scene -->
    <div class="relative z-10 px-6 pb-6">
      <HomePlayControl :instance="instance" />
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
const RANGE = 14

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
