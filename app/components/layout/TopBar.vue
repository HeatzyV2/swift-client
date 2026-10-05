<template>
  <header
    data-tauri-drag-region
    class="fixed inset-x-0 top-0 z-[100] flex h-[60px] select-none items-center justify-between border-b-[3px] border-[var(--sw-line)] bg-[var(--sw-canvas)]"
    @pointerdown.self.stop
  >
    <div data-tauri-drag-region class="flex h-full items-center gap-3" :class="isMac ? 'pl-[84px]' : 'pl-[22px]'">
      <BrandMark class="size-7 text-primary" />
      <span data-tauri-drag-region class="sw-sign-text text-[22px] font-bold uppercase leading-none tracking-[0.08em] text-highlighted">
        Swift<span class="ml-2 text-[13px] font-medium tracking-[0.2em] text-muted">Client</span>
      </span>
      <span v-if="compact" class="ml-2 border-l border-default pl-3 text-xs text-dimmed">{{ $t('browserWindow.title') }}</span>
    </div>

    <div class="flex h-full items-center gap-2" :class="isMac ? 'pr-4' : ''" style="-webkit-app-region: no-drag">
      <template v-if="!compact">
        <button
          type="button"
          class="sw-block-flat hidden h-9 items-center gap-2 px-3 text-xs text-muted transition-colors hover:text-highlighted sm:flex"
          :aria-label="$t('swiftx.palette.placeholder')"
          @click="palette.open.value = true"
        >
          <UIcon name="i-pixelarticons-search" class="size-4" />
          <span class="font-display tracking-wide">{{ $t('swiftx.palette.hint') }}</span>
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
