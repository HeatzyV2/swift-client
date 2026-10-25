<template>
  <section class="relative isolate flex min-h-[250px] overflow-hidden rounded-[16px] border border-[var(--sw-line)] bg-[var(--sw-canvas)] shadow-xl">
    <!-- Background scene, darkened so the text reads -->
    <img
      :src="rotation.current.value.src"
      alt=""
      draggable="false"
      class="pointer-events-none absolute inset-0 size-full object-cover opacity-70"
      :style="{ objectPosition: rotation.current.value.position ?? '50% 50%' }"
    >
    <div class="sw-scene pointer-events-none absolute inset-0 opacity-[0.75]" />
    <div class="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgb(5_7_11/0.35)_0%,rgb(5_7_11/0.7)_40%,rgb(5_7_11/0.55)_100%)]" />

    <!-- The player's skin, live, cut by the bottom of the card -->
    <div class="relative w-[clamp(170px,24%,230px)] shrink-0 self-stretch">
      <HomeSkinStage :skin="skin" class="absolute inset-x-0 top-1 -bottom-20" />
    </div>

    <div class="relative flex min-w-0 flex-1 flex-col justify-center gap-3.5 py-8 pr-8 pl-[clamp(24px,4vw,56px)]">
      <div class="flex min-w-0 items-center">
        <h2 class="font-headline truncate text-[clamp(38px,4.2vw,54px)] font-extrabold! uppercase leading-[0.95] text-white">
          {{ account?.username ?? $t('account.signIn') }}
        </h2>
      </div>

      <!-- Selected profile at a glance -->
      <p v-if="instance" class="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13.5px] text-[#c3cad6]">
        <span class="inline-flex items-center gap-1.5">
          <UIcon name="i-lucide-box" class="size-4" />
          <b class="font-semibold text-white">{{ instance.mc_version }}</b>
          <span v-if="instance.loader.type !== 'vanilla'">· {{ loaderLabel(instance.loader.type) }}</span>
        </span>
        <span class="inline-flex items-center gap-1.5">
          <UIcon name="i-lucide-globe" class="size-4" />
          <i18n-t keypath="home.hero.worlds" :plural="worlds ?? 0" tag="span">
            <template #n><b class="font-semibold text-white">{{ worlds ?? '—' }}</b></template>
          </i18n-t>
        </span>
        <span class="inline-flex items-center gap-1.5">
          <UIcon name="i-lucide-clock" class="size-4" />
          <i18n-t keypath="home.hero.played" tag="span">
            <template #time><b class="font-semibold text-white">{{ hours }}</b></template>
          </i18n-t>
        </span>
      </p>
      <p v-else class="text-[13.5px] text-[#c3cad6]">{{ $t('home.quickStart.hint') }}</p>

      <HomePlayControl :instance="instance" class="mt-1.5" />

      <p v-if="instance" class="text-[13px] text-[#aab3c2]">
        {{ lastPlayed ? $t('home.hero.lastPlayed', { when: lastPlayed }) : $t('instance.neverPlayed') }}
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import type { Instance, WorldInfo } from '~/types/launcher'

const props = defineProps<{ instance?: Instance }>()

const { locale } = useI18n()
const accounts = useAccountStore()
const rotation = useHeroRotation()
const { skin } = usePlayerSkin()

const account = computed(() => accounts.activeAccount)
const lastPlayed = computed(() => formatRelative(props.instance?.last_played, locale.value))

/** Hours with one decimal, like "5.1 h": the time spent in this profile. */
const hours = computed(() => {
  const h = (props.instance?.playtime_seconds ?? 0) / 3600
  return new Intl.NumberFormat(locale.value, { style: 'unit', unit: 'hour', unitDisplay: 'narrow', maximumFractionDigits: h < 10 ? 1 : 0 }).format(h)
})

const worlds = ref<number | null>(null)
watch(() => props.instance?.id, async (id) => {
  worlds.value = null
  if (!id) return
  const list = await invoke<WorldInfo[]>('list_worlds', { id }).catch(() => null)
  if (props.instance?.id === id && list) worlds.value = list.length
}, { immediate: true })
</script>
