<template>
  <div v-if="maintenance || shown.length" class="relative z-30 flex flex-col">
    <!-- Maintenance: always visible while it lasts -->
    <div v-if="maintenance" class="sw-notice" data-tone="danger" role="alert">
      <UIcon name="i-pixelarticons-warning-box" class="size-4 shrink-0" />
      <p class="min-w-0 flex-1 text-[12.5px] leading-snug">
        <b class="font-semibold">{{ t('platform.maintenance.title') }}</b>
        <span v-if="maintenance.message"> — {{ maintenance.message }}</span>
        <span v-if="maintenance.endsAt" class="opacity-75"> · {{ t('platform.maintenance.until', { date: formatDate(maintenance.endsAt) }) }}</span>
      </p>
    </div>

    <div v-for="a in shown" :key="a.id" class="sw-notice" :data-tone="tone(a.type)" :role="a.type === 'critical' ? 'alert' : 'status'">
      <UIcon :name="icon(a.type)" class="size-4 shrink-0" />
      <p class="min-w-0 flex-1 text-[12.5px] leading-snug">
        <b class="font-semibold">{{ a.title }}</b>
        <span v-if="a.body"> — {{ a.body }}</span>
      </p>
      <UButton v-if="a.linkUrl" size="xs" color="neutral" variant="soft" :label="t('platform.announcement.open')" @click="open(a.linkUrl)" />
      <UButton v-if="a.dismissible" size="xs" color="neutral" variant="ghost" icon="i-pixelarticons-close" square :aria-label="t('platform.announcement.dismiss')" @click="dismiss(a.id)" />
    </div>
  </div>

  <!-- First time maintenance is seen in a session: say it clearly once -->
  <Transition name="sw-fade">
    <div v-if="maintenance && !maintenanceSeen" class="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-6" @click.self="maintenanceSeen = true">
      <div class="sw-block flex max-w-md flex-col items-center gap-3 px-8 py-7 text-center">
        <UIcon name="i-pixelarticons-warning-box" class="size-9 text-[var(--sw-warning)]" />
        <p class="font-display text-lg font-semibold text-highlighted">{{ t('platform.maintenance.title') }}</p>
        <p class="text-sm text-muted">{{ maintenance.message || t('platform.maintenance.default') }}</p>
        <p class="text-xs text-dimmed">{{ t('platform.maintenance.hint') }}</p>
        <UButton color="primary" :label="t('platform.maintenance.continue')" @click="maintenanceSeen = true" />
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
const { t, locale } = useI18n()
const { announcements, maintenance, maintenanceSeen, dismiss } = useSwiftPlatform()
/** Most severe first (the server sorts them); two at most so the banners never crowd the app. */
const shown = computed(() => announcements.value.slice(0, 2))

const tone = (type: string) => ({ info: 'info', success: 'success', warning: 'warning', critical: 'danger' }[type] ?? 'info')
const icon = (type: string) => ({
  info: 'i-pixelarticons-info-box', success: 'i-pixelarticons-check', warning: 'i-pixelarticons-warning-box', critical: 'i-pixelarticons-warning-box',
}[type] ?? 'i-pixelarticons-info-box')

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleString(locale.value, { dateStyle: 'medium', timeStyle: 'short' }) } catch { return iso }
}

function open(url: string) {
  openExternal(url)
}
</script>

<style scoped>
.sw-notice {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1.25rem;
  color: var(--sw-text, #fff);
  background: color-mix(in srgb, var(--tone) 16%, var(--sw-surface-2, #11151f));
  border-bottom: 2px solid color-mix(in srgb, var(--tone) 55%, transparent);
}
.sw-notice[data-tone='info'] { --tone: var(--sw-accent, #3b82f6); }
.sw-notice[data-tone='success'] { --tone: var(--sw-success, #3ecf8e); }
.sw-notice[data-tone='warning'] { --tone: var(--sw-warning, #f2a33a); }
.sw-notice[data-tone='danger'] { --tone: var(--sw-danger, #f2555a); }
.sw-notice :deep(svg) { color: var(--tone); }
</style>
