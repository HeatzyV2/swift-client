<template>
  <section class="relative isolate h-[clamp(430px,60vh,660px)] overflow-hidden rounded-[20px] border border-[var(--sw-line)] bg-[#0a1020]">
    <!-- Backdrop: the instance's latest screenshot, or Swift's artwork -->
    <Transition name="sw-crossfade">
      <img
        :key="backdrop.src.value"
        :src="backdrop.src.value"
        alt=""
        draggable="false"
        class="absolute inset-0 size-full object-cover"
        :class="backdrop.isScreenshot.value ? 'scale-[1.04] blur-[2px] brightness-[0.8]' : ''"
      >
    </Transition>
    <div class="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgb(7_8_11/0.95)_0%,rgb(7_8_11/0.55)_38%,transparent_70%)]" />
    <div class="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgb(7_8_11/0.82)_0%,rgb(7_8_11/0.35)_42%,transparent_65%)]" />

    <!-- Player -->
    <div class="pointer-events-none absolute bottom-0 right-[6%] flex h-[93%] w-[34%] min-w-[220px] flex-col items-center justify-end">
      <Transition name="sw-rise" mode="out-in">
        <div v-if="playerImage" :key="playerImage" class="flex h-full w-full flex-col items-center justify-end">
          <span class="mb-2 rounded-md bg-black/55 px-3 py-1 font-mono text-[15px] font-medium tracking-wide text-white">
            {{ username }}
          </span>
          <img
            :src="playerImage"
            alt=""
            draggable="false"
            class="min-h-0 w-auto flex-1 object-contain object-bottom drop-shadow-[0_24px_40px_rgb(0_0_0/0.55)]"
          >
        </div>
        <BrandMark v-else class="mb-[18%] size-[38%] text-white/[0.06]" />
      </Transition>
    </div>

    <div class="pointer-events-none absolute inset-x-0 bottom-0 h-[16%] bg-[linear-gradient(to_top,rgb(7_8_11/0.9),transparent)]" />

    <!-- Instance + Play -->
    <div class="absolute inset-y-0 left-0 flex w-[min(620px,64%)] flex-col justify-end gap-6 p-10">
      <Transition name="sw-rise" mode="out-in">
        <div v-if="instance" :key="instance.id" class="min-w-0">
          <div class="mb-3 flex flex-wrap items-center gap-2">
            <span class="sw-hero-chip">{{ loaderLabel(instance.loader.type) }}<span v-if="loaderVersion" class="ml-1.5 font-mono text-white/55">{{ loaderVersion }}</span></span>
            <span class="sw-hero-chip font-mono">{{ instance.mc_version }}</span>
            <span v-if="running" class="sw-hero-chip text-[var(--sw-success)]">
              <span class="mr-1.5 size-1.5 rounded-full bg-[var(--sw-success)]" />{{ $t('instance.running') }}
            </span>
          </div>
          <h1 class="truncate font-display text-[clamp(32px,3.6vw,50px)] font-bold leading-[1.05] tracking-[-0.02em] text-white">
            {{ instance.name }}
          </h1>
          <p class="mt-2 flex items-center gap-3 text-sm text-white/60">
            <span class="inline-flex items-center gap-1.5"><UIcon name="i-lucide-clock" class="size-3.5" />{{ lastPlayed ?? $t('instance.neverPlayed') }}</span>
            <span v-if="instance.playtime_seconds" class="inline-flex items-center gap-1.5"><UIcon name="i-lucide-hourglass" class="size-3.5" />{{ formatPlaytime(instance.playtime_seconds) }}</span>
          </p>
        </div>
        <div v-else key="welcome">
          <p class="sw-eyebrow mb-3 !text-primary">{{ BRAND.name }}</p>
          <h1 class="font-display text-[clamp(32px,3.6vw,48px)] font-bold leading-[1.05] tracking-[-0.02em] text-white">{{ $t('home.welcome.title') }}</h1>
          <p class="mt-3 max-w-md text-[15px] text-white/65">{{ $t('home.welcome.text') }}</p>
        </div>
      </Transition>

      <HomePlayControl :instance="instance" />
    </div>
  </section>
</template>

<script setup lang="ts">
import type { Instance } from '~/types/launcher'

const props = defineProps<{ instance?: Instance }>()

const accounts = useAccountStore()
const activity = useActivityCenter()
const { locale } = useI18n()

const backdrop = useHeroBackdrop(computed(() => props.instance?.id))
const { skin } = usePlayerSkin()
const playerImage = usePlayerRender(skin)

const username = computed(() => accounts.activeAccount?.username ?? '')
const loaderVersion = computed(() => (props.instance && 'version' in props.instance.loader ? props.instance.loader.version : ''))
const lastPlayed = computed(() => formatRelative(props.instance?.last_played, locale.value))
const running = computed(() => !!props.instance && activity.list.value.some(a => a.instanceId === props.instance!.id && a.kind === 'running'))
</script>

<style scoped>
.sw-hero-chip {
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0 10px;
  border-radius: 7px;
  background: rgb(255 255 255 / 0.08);
  border: 1px solid rgb(255 255 255 / 0.1);
  font-size: 12px;
  font-weight: 500;
  color: rgb(255 255 255 / 0.85);
}
</style>
