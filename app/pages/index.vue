<template>
  <div class="h-full overflow-y-auto">
    <div class="mx-auto flex max-w-[1600px] flex-col gap-8 px-7 pb-14 pt-6">
      <div v-if="!instances.loaded" class="sw-skeleton h-[clamp(500px,66vh,660px)] rounded-[22px]" />
      <UiEmptyState
        v-else-if="instances.error && !instances.instances.length"
        icon="i-lucide-triangle-alert"
        :title="$t('library.loadError')"
        :description="instances.error"
        class="sw-block"
      >
        <UButton color="neutral" variant="soft" icon="i-lucide-refresh-cw" :label="$t('common.retry')" @click="instances.load()" />
      </UiEmptyState>
      <HomeHero v-else :instance="instances.selected" class="sw-rise-in" />

      <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div class="flex min-w-0 flex-col gap-8">
          <HomeNews class="sw-rise-in [animation-delay:80ms]" />
          <!-- Sections published from the admin platform (hero, servers, partners, links…) -->
          <PlatformHomeSections />
        </div>
        <div class="flex min-w-0 flex-col gap-4">
          <HomeAvatarCard part="stats" class="sw-rise-in [animation-delay:120ms]" />
          <HomeSidePanel :instance="instances.selected" class="sw-rise-in [animation-delay:160ms]" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const instances = useInstancesStore()

let viewed = false
onMounted(() => {
  instances.ensureLoaded()
  if (!viewed) {
    viewed = true
    track('home_view')
  }
})
</script>
