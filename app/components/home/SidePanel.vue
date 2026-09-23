<template>
  <aside class="grid content-start gap-7 md:grid-cols-2 xl:grid-cols-1">
    <HomeFeaturedCard v-if="FEATURED" :card="FEATURED" class="sw-rise-in" />

    <HomeJumpBackIn :instance="instance" class="sw-rise-in [animation-delay:60ms]" />

    <section class="sw-rise-in [animation-delay:120ms]">
      <h2 class="mb-3 font-display text-[15px] font-semibold text-highlighted">{{ $t('home.overview') }}</h2>
      <dl class="grid grid-cols-2 gap-2">
        <div class="rounded-xl bg-[var(--sw-surface)] px-4 py-3.5">
          <dt class="text-[11px] text-dimmed">{{ $t('home.instancesCount') }}</dt>
          <dd class="mt-1 font-display text-2xl font-semibold text-highlighted">{{ instances.instances.length }}</dd>
        </div>
        <div class="rounded-xl bg-[var(--sw-surface)] px-4 py-3.5">
          <dt class="text-[11px] text-dimmed">{{ $t('home.totalPlaytime') }}</dt>
          <dd class="mt-1 font-display text-2xl font-semibold text-highlighted">{{ totalHours }}</dd>
        </div>
      </dl>
    </section>
  </aside>
</template>

<script setup lang="ts">
import { FEATURED } from '~/content/home'
import type { Instance } from '~/types/launcher'

defineProps<{ instance?: Instance }>()

const instances = useInstancesStore()

const totalHours = computed(() => {
  const seconds = instances.instances.reduce((sum, i) => sum + (i.playtime_seconds ?? 0), 0)
  return `${Math.floor(seconds / 3600)} h`
})
</script>
