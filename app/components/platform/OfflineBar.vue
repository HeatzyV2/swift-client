<template>
  <Transition name="sw-fade">
    <div v-if="offline" class="sw-offline" role="status">
      <UIcon name="i-pixelarticons-cellular-signal-off" class="size-4 shrink-0" />
      <p class="min-w-0 flex-1 text-[12.5px] leading-snug">
        <b class="font-semibold">{{ t('platform.offline.title') }}</b>
        <span> — {{ t('platform.offline.body') }}</span>
      </p>
      <UButton size="xs" color="neutral" variant="soft" icon="i-pixelarticons-reload" :label="t('platform.offline.retry')" :loading="retrying" @click="retry" />
    </div>
  </Transition>
</template>

<script setup lang="ts">
const { t } = useI18n()
const { offline, load } = useSwiftPlatform()
const retrying = ref(false)

/** Asks the platform again; the bar goes away by itself once the answer is fresh. */
async function retry() {
  retrying.value = true
  try { await load() } finally { retrying.value = false }
}

// The browser's own signal gives the quickest reaction when the network comes back
onMounted(() => {
  window.addEventListener('online', retry)
})
onBeforeUnmount(() => {
  window.removeEventListener('online', retry)
})
</script>

<style scoped>
.sw-offline {
  position: relative;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.4rem 1.25rem;
  color: var(--sw-text, #fff);
  background: color-mix(in srgb, var(--sw-warning, #f2a33a) 12%, var(--sw-surface-2, #11151f));
  border-bottom: 2px solid color-mix(in srgb, var(--sw-warning, #f2a33a) 45%, transparent);
}
.sw-offline :deep(svg) { color: var(--sw-warning, #f2a33a); }
</style>
