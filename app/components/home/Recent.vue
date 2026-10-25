<template>
  <!-- The last profiles played: a click selects one, the arrow launches it -->
  <div v-if="recent.length" class="grid grid-cols-3 gap-3">
    <div
      v-for="inst in recent"
      :key="inst.id"
      class="group flex h-[54px] min-w-0 items-center gap-3 rounded-[10px] border border-[var(--sw-line)] bg-[var(--sw-surface)] pl-2.5 pr-1.5 transition-colors duration-150 hover:border-[var(--sw-line-strong)] hover:bg-[var(--sw-surface-2)]"
      :class="inst.id === instances.selectedId ? 'border-[color-mix(in_srgb,var(--sw-accent)_45%,var(--sw-line))]' : ''"
    >
      <button type="button" class="flex min-w-0 flex-1 items-center gap-3 text-left" @click="instances.select(inst.id)">
        <InstanceIcon :instance="inst" class="size-8 shrink-0 rounded-[7px] text-xs" />
        <span class="min-w-0">
          <span class="block truncate text-[14px] font-bold leading-tight text-highlighted">{{ inst.name }}</span>
          <span class="block truncate text-[12px] leading-tight text-dimmed">{{ formatRelative(inst.last_played, locale) }}</span>
        </span>
      </button>
      <UTooltip :text="$t('instance.play')">
        <button
          type="button"
          class="flex size-9 shrink-0 items-center justify-center rounded-[8px] text-primary transition-colors hover:bg-[var(--sw-accent-soft)]"
          :aria-label="`${$t('instance.play')} ${inst.name}`"
          @click="play(inst.id)"
        >
          <UIcon name="i-lucide-play" class="size-4" />
        </button>
      </UTooltip>
    </div>
  </div>
  <p v-else class="sw-home-empty h-[54px]">
    <UIcon name="i-lucide-history" class="size-4 shrink-0 text-dimmed" />
    {{ $t('home.recent.empty') }}
  </p>
</template>

<script setup lang="ts">
const instances = useInstancesStore()
const launchFlow = useLaunchFlow()
const { locale } = useI18n()

const recent = computed(() =>
  [...instances.instances]
    .filter(i => i.last_played)
    .sort((a, b) => (b.last_played ?? '').localeCompare(a.last_played ?? ''))
    .slice(0, 3),
)

function play(id: string) {
  instances.select(id)
  launchFlow.play(id)
}
</script>
