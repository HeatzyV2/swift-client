<template>
  <div class="h-full overflow-y-auto">
    <div class="mx-auto grid max-w-[1720px] gap-8 px-7 pb-12 pt-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div class="min-w-0 space-y-10">
        <div v-if="!instances.loaded" class="sw-skeleton h-[clamp(430px,60vh,660px)] rounded-[20px]" />
        <UiEmptyState
          v-else-if="instances.error && !instances.instances.length"
          icon="i-lucide-triangle-alert"
          :title="$t('library.loadError')"
          :description="instances.error"
          class="rounded-[20px] border border-[var(--sw-line)]"
        >
          <UButton color="neutral" variant="soft" icon="i-lucide-rotate-cw" :label="$t('common.retry')" @click="instances.load()" />
        </UiEmptyState>
        <HomeHero v-else :instance="instances.selected" class="sw-rise-in" />

        <HomeNews />
      </div>

      <HomeSidePanel :instance="instances.selected" class="self-start xl:sticky xl:top-6" />
    </div>
  </div>
</template>

<script setup lang="ts">
const instances = useInstancesStore()

onMounted(() => {
  instances.ensureLoaded()
})
</script>
