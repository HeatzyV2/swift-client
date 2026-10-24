<template>
  <div
    class="sw-panel sw-panel-interactive group relative flex cursor-pointer select-none items-center gap-3 p-3"
    :class="selected ? 'border-primary/40' : ''"
  >
    <div class="relative size-11 shrink-0">
      <InstanceIcon :instance="instance" class="size-full rounded-md text-lg transition duration-150 group-hover:brightness-[0.4]" />
      <button
        type="button"
        class="absolute inset-0 flex items-center justify-center rounded-md opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100"
        :aria-label="$t('ctx.play')"
        :title="$t('ctx.play')"
        @click.stop="$emit('play')"
      >
        <UIcon
          :name="busy ? 'i-lucide-loader-circle' : 'i-lucide-play'"
          class="size-5 text-white"
          :class="{ 'animate-spin': busy }"
        />
      </button>
    </div>

    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <span class="truncate text-[14px] font-medium text-highlighted">{{ instance.name }}</span>
        <span v-if="running" class="size-1.5 shrink-0 rounded-full bg-[var(--sw-success)]" :title="$t('instance.running')" />
      </div>
      <div class="mt-0.5 truncate font-mono text-[11px] text-muted">{{ instanceSubtitle(instance) }}</div>
      <div class="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-dimmed">
        <span class="truncate">{{ lastPlayed ?? $t('instance.neverPlayed') }}</span>
        <template v-if="playtime">
          <span>·</span>
          <span class="inline-flex shrink-0 items-center gap-1" :title="$t('instance.playtime')">
            <UIcon name="i-lucide-hourglass" class="size-3" />{{ playtime }}
          </span>
        </template>
      </div>
    </div>

    <UIcon v-if="selected" name="i-lucide-star" class="size-3.5 shrink-0 text-primary" :title="$t('library.selected')" />
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
