<template>
  <div
    class="sw-inst-card group relative flex cursor-pointer select-none flex-col"
    :class="{ 'is-selected': selected }"
  >
    <div class="flex items-center gap-3.5">
      <InstanceIcon :instance="instance" class="size-14 shrink-0 rounded-[12px] text-xl shadow-[0_6px_18px_rgb(0_0_0/0.35)]" />
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <span class="truncate text-[15px] font-bold text-highlighted">{{ instance.name }}</span>
          <span v-if="running" class="size-2 shrink-0 rounded-full bg-[var(--sw-success)] shadow-[0_0_8px_var(--sw-success)]" :title="$t('instance.running')" />
          <UIcon v-if="selected" name="i-lucide-star" class="size-3.5 shrink-0 text-primary" :title="$t('library.selected')" />
        </div>
        <p class="mt-1 flex items-center gap-1.5 text-[12.5px] text-muted">
          <UIcon name="i-lucide-box" class="size-3.5 text-dimmed" />
          <b class="font-semibold text-toned">{{ instance.mc_version }}</b>
          <span v-if="instance.loader.type !== 'vanilla'">· {{ loaderLabel(instance.loader.type) }}</span>
        </p>
      </div>

      <!-- Play straight from the card -->
      <button
        type="button"
        class="sw-inst-play"
        :aria-label="$t('ctx.play')"
        :title="$t('ctx.play')"
        @click.stop="$emit('play')"
      >
        <UIcon :name="busy ? 'i-lucide-loader-circle' : 'i-lucide-play'" class="size-[18px]" :class="{ 'animate-spin': busy }" />
      </button>
    </div>

    <div class="mt-3.5 flex items-center gap-3 border-t border-[var(--sw-line)] pt-3 text-[12px] text-dimmed">
      <span class="inline-flex min-w-0 items-center gap-1.5">
        <UIcon name="i-lucide-clock" class="size-3.5 shrink-0" />
        <span class="truncate">{{ lastPlayed ?? $t('instance.neverPlayed') }}</span>
      </span>
      <span v-if="playtime" class="ml-auto inline-flex shrink-0 items-center gap-1.5" :title="$t('instance.playtime')">
        <UIcon name="i-lucide-hourglass" class="size-3.5" />{{ playtime }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Instance } from '~/types/launcher'

const props = defineProps<{ instance: Instance, selected?: boolean, busy?: boolean, running?: boolean }>()
defineEmits<{ play: [] }>()

const { locale } = useI18n()
const lastPlayed = computed(() => formatRelative(props.instance.last_played, locale.value))
const playtime = computed(() => props.instance.playtime_seconds ? formatPlaytime(props.instance.playtime_seconds, locale.value) : null)
</script>

<style scoped>
.sw-inst-card {
  padding: 14px 14px 12px;
  border-radius: 14px;
  border: 1px solid var(--sw-line);
  background: var(--sw-surface);
  transition: transform 180ms var(--ease-swift), border-color 180ms var(--ease-swift), background-color 180ms var(--ease-swift), box-shadow 180ms var(--ease-swift);
}
.sw-inst-card:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--sw-accent) 35%, var(--sw-line));
  background: var(--sw-surface-2);
  box-shadow: var(--shadow-md);
}
.sw-inst-card.is-selected {
  border-color: color-mix(in srgb, var(--sw-accent) 55%, var(--sw-line));
}
.sw-inst-play {
  display: flex;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: var(--sw-accent-soft);
  color: var(--sw-accent);
  transition: background-color 160ms var(--ease-swift), color 160ms var(--ease-swift), transform 160ms var(--ease-swift);
}
.sw-inst-card:hover .sw-inst-play,
.sw-inst-play:focus-visible {
  background: var(--sw-accent);
  color: var(--sw-accent-fg);
}
.sw-inst-play:active {
  transform: scale(0.94);
}
</style>
