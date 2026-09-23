<template>
  <header
    data-tauri-drag-region
    class="fixed inset-x-0 top-0 z-[100] flex h-[60px] select-none items-center justify-between border-b border-[var(--sw-line-soft)] bg-[var(--sw-canvas)]"
    @pointerdown.self.stop
  >
    <div data-tauri-drag-region class="flex h-full items-center gap-3" :class="isMac ? 'pl-[84px]' : 'pl-[22px]'">
      <BrandMark class="size-7 text-primary" />
      <span data-tauri-drag-region class="font-display text-[15px] font-bold uppercase tracking-[0.2em] text-highlighted">
        Swift<span class="ml-1.5 font-medium text-muted">Client</span>
      </span>
      <span v-if="compact" class="ml-2 border-l border-default pl-3 text-xs text-dimmed">{{ $t('browserWindow.title') }}</span>
    </div>

    <div class="flex h-full items-center gap-2" :class="isMac ? 'pr-4' : ''" style="-webkit-app-region: no-drag">
      <template v-if="!compact">
        <LayoutStatusChip />
        <LayoutAccountMenu />
        <div class="mx-1 h-6 w-px bg-[var(--sw-line)]" />
      </template>
      <WindowControls />
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{ compact?: boolean }>()

const { platform } = usePlatform()
const isMac = computed(() => platform.value === 'macos')
</script>
