<template>
  <div class="h-full overflow-y-auto">
    <div class="mx-auto flex max-w-[1600px] flex-col gap-10 px-7 pb-14 pt-6">
      <!-- The player card on the left; the scene with Play and the status panels on the right -->
      <div class="grid gap-3.5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <HomeAvatarCard class="sw-rise-in" />

        <div class="flex min-w-0 flex-col gap-3.5">
          <div v-if="!instances.loaded" class="sw-skeleton h-[clamp(300px,44vh,440px)] rounded-[6px]" />
          <UiEmptyState
            v-else-if="instances.error && !instances.instances.length"
            icon="i-pixelarticons-warning-box"
            :title="$t('library.loadError')"
            :description="instances.error"
            class="sw-block"
          >
            <UButton color="neutral" variant="soft" icon="i-pixelarticons-reload" :label="$t('common.retry')" @click="instances.load()" />
          </UiEmptyState>
          <HomeHero v-else :instance="instances.selected" class="sw-rise-in [animation-delay:60ms]" />

          <HomeSidePanel :instance="instances.selected" class="sw-rise-in [animation-delay:120ms]" />
        </div>
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
