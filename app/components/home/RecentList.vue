<template>
  <section>
    <div class="mb-3 flex items-center justify-between">
      <h3 class="sw-eyebrow">{{ $t('home.recent') }}</h3>
      <NuxtLink to="/instances" class="text-xs text-muted transition-colors hover:text-highlighted">{{ $t('home.viewAll') }}</NuxtLink>
    </div>

    <div v-if="!items.length" class="sw-panel px-4 py-6 text-center text-sm text-dimmed">
      {{ $t('home.noOtherInstances') }}
    </div>

    <ul v-else class="sw-panel divide-y divide-[var(--sw-line-soft)] overflow-hidden">
      <li
        v-for="inst in items"
        :key="inst.id"
        class="group flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--sw-surface-2)]"
        @click="instances.select(inst.id)"
      >
        <InstanceIcon :instance="inst" class="size-8 rounded-md text-sm" />
        <div class="min-w-0 flex-1">
          <div class="truncate text-[13px] font-medium text-highlighted">{{ inst.name }}</div>
          <div class="truncate font-mono text-[11px] text-dimmed">{{ instanceSubtitle(inst) }}</div>
        </div>
        <span class="hidden shrink-0 text-xs text-dimmed sm:block">{{ formatRelative(inst.last_played, locale) ?? $t('instance.neverPlayed') }}</span>
        <UTooltip :text="$t('ctx.play')">
          <UButton
            icon="i-lucide-play"
            size="sm"
            color="neutral"
            variant="ghost"
            square
            class="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            :aria-label="$t('ctx.play')"
            @click.stop="launchFlow.play(inst.id)"
          />
        </UTooltip>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{ excludeId?: string | null }>()

const instances = useInstancesStore()
const launchFlow = useLaunchFlow()
const { locale } = useI18n()

const LIMIT = 5
const items = computed(() => {
  const others = instances.instances.filter(i => i.id !== props.excludeId)
  const played = others.filter(i => i.last_played).sort((a, b) => b.last_played!.localeCompare(a.last_played!))
  const unplayed = others.filter(i => !i.last_played)
  return [...played, ...unplayed].slice(0, LIMIT)
})
</script>
