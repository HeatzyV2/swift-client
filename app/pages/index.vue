<template>
  <div class="h-full overflow-y-auto">
    <div class="mx-auto flex max-w-[1180px] flex-col gap-8 px-8 py-7">
      <div v-if="!instances.loaded" class="flex flex-col gap-8">
        <div class="sw-panel flex h-[276px] items-end justify-between gap-8 rounded-2xl p-8">
          <div class="flex items-center gap-5">
            <div class="sw-skeleton size-[72px]" />
            <div class="space-y-3">
              <div class="sw-skeleton h-8 w-72" />
              <div class="sw-skeleton h-5 w-44" />
            </div>
          </div>
          <div class="sw-skeleton h-14 w-[260px]" />
        </div>
      </div>

      <UiEmptyState
        v-else-if="instances.error && !instances.instances.length"
        icon="i-lucide-triangle-alert"
        :title="$t('library.loadError')"
        :description="instances.error"
      >
        <UButton color="neutral" variant="soft" icon="i-lucide-rotate-cw" :label="$t('common.retry')" @click="instances.load()" />
      </UiEmptyState>

      <HomeWelcome v-else-if="!instances.selected" />

      <template v-else>
        <HomeLaunchPanel :instance="instances.selected" :settings="settings" />
        <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <HomeRecentList :exclude-id="instances.selectedId" />
          <HomeQuickActions :instance="instances.selected" />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import type { Settings } from '~/types/launcher'

const instances = useInstancesStore()
const settings = ref<Settings | null>(null)

onMounted(async () => {
  instances.ensureLoaded()
  settings.value = await invoke<Settings>('get_settings').catch(() => null)
})
</script>
