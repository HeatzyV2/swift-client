<template>
  <header
    data-tauri-drag-region
    class="fixed inset-x-0 top-0 z-[100] flex h-[60px] select-none items-center justify-between border-b border-[var(--sw-line)] bg-[var(--sw-stage)]"
    @pointerdown.self.stop
  >
    <div data-tauri-drag-region class="flex h-full items-center gap-3" :class="isMac ? 'pl-[84px]' : 'pl-[22px]'">
      <BrandMark class="size-7 text-primary" />
      <span data-tauri-drag-region class="font-pixel text-[20px] font-bold uppercase leading-none text-highlighted">
        Swift<span class="ml-1.5 text-primary">Client</span>
      </span>
      <span v-if="compact" class="ml-2 border-l border-default pl-3 text-xs text-dimmed">{{ $t('browserWindow.title') }}</span>
    </div>

    <div class="flex h-full items-center gap-2" :class="isMac ? 'pr-4' : ''" style="-webkit-app-region: no-drag">
      <template v-if="!compact">
        <button
          type="button"
          class="hidden h-9 w-[220px] items-center gap-2 rounded-[10px] border border-[var(--sw-line)] bg-[var(--sw-surface)] px-3 text-xs text-muted transition-colors hover:border-[var(--sw-line-strong)] hover:text-highlighted sm:flex"
          :aria-label="$t('swiftx.palette.placeholder')"
          @click="palette.open.value = true"
        >
          <UIcon name="i-lucide-search" class="size-4" />
          <span class="flex-1 text-left">{{ $t('swiftx.palette.hint') }}</span>
          <kbd class="rounded-[6px] bg-[var(--sw-surface-3)] px-1.5 py-0.5 font-mono text-[10.5px] text-dimmed">Ctrl K</kbd>
        </button>
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

const palette = useCommandPalette()
const { platform } = usePlatform()
const isMac = computed(() => platform.value === 'macos')
</script>
