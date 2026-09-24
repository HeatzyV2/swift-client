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
      <div class="pointer-events-none relative flex h-[64%] min-h-0 w-full flex-col items-center justify-end pb-[2.5%]">
        <Transition name="sw-rise" mode="out-in">
          <div v-if="playerImage" :key="playerImage" class="relative flex h-full w-full flex-col items-center justify-end">
            <!-- Soft accent backlight behind the player -->
            <div class="sw-player-backlight" />
            <span
              v-if="accounts.activeAccount"
              class="sw-glass relative mb-3 rounded-md px-3 py-1 font-mono text-[14px] font-medium tracking-wide text-white shadow-[0_4px_20px_rgb(0_0_0/0.45)]"
            >{{ accounts.activeAccount.username }}</span>
            <!-- Size container: the rim light and shadow scale with the render, not the window -->
            <div class="sw-player-stage relative min-h-0 w-full flex-1">
              <div class="relative mx-auto h-full w-fit">
                <!-- Contact shadow where the player meets the ground -->
                <div class="sw-player-ground" />
                <img
                  :src="playerImage"
                  alt=""
                  draggable="false"
                  class="sw-player relative h-full w-auto object-contain object-bottom"
                >
              </div>
            </div>
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

<style scoped>
/*
 * Depth for the player render, lit from behind and to the right:
 * - a thin accent rim that only shows on the right-facing edges (offset, not
 *   traced all round, so it reads as back-light rather than an outline),
 * - a faint accent spill on the same side,
 * - a soft dark shadow falling forward.
 * Sizes are in cqh of .sw-player-stage, so the effect keeps its proportions
 * from the smallest hero to the largest.
 */
.sw-player-stage {
  container-type: size;
}
.sw-player {
  /* Rim is the accent lifted towards white so it still reads over a bright sky */
  --rim: color-mix(in srgb, var(--sw-accent) 72%, #ffffff);
  filter:
    drop-shadow(0.75cqh -0.3cqh 0.2cqh color-mix(in srgb, var(--rim) 85%, transparent))
    drop-shadow(1.4cqh -0.5cqh 2.4cqh color-mix(in srgb, var(--sw-accent) 42%, transparent))
    drop-shadow(-0.6cqh 2.2cqh 3cqh rgb(0 0 0 / 0.4));
}
.sw-player-backlight {
  position: absolute;
  left: 54%;
  bottom: 10%;
  width: min(380px, 62%);
  aspect-ratio: 1;
  translate: -50% 0;
  border-radius: 9999px;
  background: radial-gradient(closest-side, color-mix(in srgb, var(--sw-accent) 20%, transparent), transparent);
  filter: blur(24px);
}
/* Blurred ellipse under the feet: dark, slightly blue, soft all the way out */
.sw-player-ground {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 108%;
  aspect-ratio: 5 / 1;
  translate: -50% 45%;
  border-radius: 9999px;
  background: radial-gradient(
    closest-side,
    rgb(2 6 20 / 0.92) 0%,
    rgb(4 10 30 / 0.72) 38%,
    rgb(8 16 42 / 0.32) 70%,
    transparent 100%
  );
}
</style>
