<template>
  <div class="h-full overflow-y-auto">
    <div class="mx-auto flex max-w-[1600px] flex-col gap-8 px-7 pb-14 pt-5">
      <!-- Hero, with the launcher's own status column beside it on wide windows -->
      <div class="grid gap-3.5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div v-if="!instances.loaded" class="sw-skeleton h-[clamp(480px,68vh,740px)] rounded-[24px]" />
        <UiEmptyState
          v-else-if="instances.error && !instances.instances.length"
          icon="i-lucide-triangle-alert"
          :title="$t('library.loadError')"
          :description="instances.error"
          class="rounded-[24px] border border-[var(--sw-line)]"
        >
          <UButton color="neutral" variant="soft" icon="i-lucide-rotate-cw" :label="$t('common.retry')" @click="instances.load()" />
        </UiEmptyState>
        <HomeHero v-else :instance="instances.selected" class="sw-rise-in" />

        <HomeSidePanel :instance="instances.selected" class="sw-rise-in [animation-delay:80ms]" />
      </div>

      <HomeNews />
    </div>
  </div>
</template>

<script setup lang="ts">
const instances = useInstancesStore()

onMounted(() => {
  instances.ensureLoaded()
})
</script>
