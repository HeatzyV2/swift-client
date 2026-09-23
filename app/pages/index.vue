<template>
  <div class="h-full overflow-y-auto">
    <div class="mx-auto flex max-w-[1600px] flex-col gap-10 px-7 pb-12 pt-6">
      <div v-if="!instances.loaded" class="sw-skeleton h-[clamp(460px,66vh,720px)] rounded-[22px]" />
      <UiEmptyState
        v-else-if="instances.error && !instances.instances.length"
        icon="i-lucide-triangle-alert"
        :title="$t('library.loadError')"
        :description="instances.error"
        class="rounded-[22px] border border-[var(--sw-line)]"
      >
        <UButton color="neutral" variant="soft" icon="i-lucide-rotate-cw" :label="$t('common.retry')" @click="instances.load()" />
      </UiEmptyState>
      <HomeHero v-else :instance="instances.selected" class="sw-rise-in" />

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
