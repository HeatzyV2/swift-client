<template>
  <section class="relative isolate h-[clamp(460px,66vh,720px)] overflow-hidden rounded-[22px] border border-white/[0.07] bg-[#090b10]">
    <!-- Background rotation -->
    <Transition name="sw-scene">
      <img
        :key="rotation.current.value.src"
        :src="rotation.current.value.src"
        alt=""
        draggable="false"
        class="absolute inset-0 size-full scale-[1.03] object-cover blur-[1.5px]"
        :style="{ objectPosition: rotation.current.value.position ?? '50% 50%' }"
      >
    </Transition>
    <div class="pointer-events-none absolute inset-0 bg-[rgb(6_8_12/0.28)]" />
    <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,transparent_35%,rgb(6_8_12/0.6)_100%)]" />
    <div class="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-[linear-gradient(to_top,rgb(6_8_12/0.92),rgb(6_8_12/0.45)_45%,transparent)]" />

    <!-- Selected instance, top left -->
    <Transition name="sw-rise" mode="out-in">
      <div v-if="instance" :key="instance.id" class="absolute left-7 top-6 flex items-center gap-3">
        <InstanceIcon :instance="instance" class="size-10 rounded-lg text-sm shadow-[0_4px_16px_rgb(0_0_0/0.4)]" />
        <div class="min-w-0 [text-shadow:0_1px_8px_rgb(0_0_0/0.6)]">
          <p class="truncate font-display text-[15px] font-semibold text-white">{{ instance.name }}</p>
          <p class="text-xs text-white/70">
            {{ lastPlayed ? $t('home.playedAgo', { when: lastPlayed }) : $t('instance.neverPlayed') }}
          </p>
        </div>
      </div>
    </Transition>

    <!-- Player and play control, centred -->
    <div class="absolute inset-0 flex flex-col items-center justify-end px-6 pb-[4.5%]">
      <div class="pointer-events-none relative flex h-[62%] min-h-0 w-full flex-col items-center justify-end">
        <Transition name="sw-rise" mode="out-in">
          <div v-if="playerImage" :key="playerImage" class="flex h-full w-full flex-col items-center justify-end">
            <span
              v-if="accounts.activeAccount"
              class="mb-2.5 rounded-lg bg-black/55 px-3.5 py-1 font-mono text-[15px] tracking-wide text-white"
            >{{ accounts.activeAccount.username }}</span>
            <img
              :src="playerImage"
              alt=""
              draggable="false"
              class="-mb-[6%] min-h-0 w-auto flex-1 object-contain object-bottom drop-shadow-[0_20px_36px_rgb(0_0_0/0.55)]"
            >
          </div>
        </Transition>
      </div>

      <HomePlayControl :instance="instance" class="relative z-10" />
    </div>

    <!-- Background picker -->
    <div v-if="rotation.list.length > 1" class="absolute bottom-5 right-6 flex items-center gap-1.5">
      <button
        v-for="(bg, i) in rotation.list"
        :key="bg.src"
        type="button"
        class="h-1.5 rounded-full transition-all duration-200"
        :class="i === rotation.index.value ? 'w-5 bg-white/85' : 'w-1.5 bg-white/30 hover:bg-white/55'"
        :aria-label="$t('home.background', { n: i + 1 })"
        @click="rotation.goTo(i)"
      />
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
</script>
