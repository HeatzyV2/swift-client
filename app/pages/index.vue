<template>
  <div class="h-full overflow-y-auto">
    <div class="mx-auto grid max-w-[1320px] gap-x-8 gap-y-8 px-[clamp(24px,4.5vw,72px)] pb-12 pt-[clamp(24px,5vh,56px)] lg:grid-cols-[minmax(0,1fr)_clamp(280px,26vw,330px)]">
      <!-- Main column: the player and their game -->
      <div class="flex min-w-0 flex-col gap-4">
        <p class="sw-eyebrow text-[12px] tracking-[0.14em]">{{ today }}</p>

        <div v-if="!instances.loaded" class="sw-skeleton h-[250px] rounded-[16px]" />
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

        <HomeRecent v-if="instances.loaded" class="sw-rise-in [animation-delay:60ms]" />

        <HomeNews class="sw-rise-in mt-4 [animation-delay:100ms]" />

        <!-- Sections published from the admin platform (hero, servers, partners, links…) -->
        <PlatformHomeSections class="mt-4" />
      </div>

      <!-- Side column: friends and partner servers -->
      <aside class="flex min-w-0 flex-col gap-10 lg:pt-[34px]">
        <HomeFriends class="sw-rise-in [animation-delay:120ms]" />
        <HomePartners class="sw-rise-in [animation-delay:160ms]" />
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
const instances = useInstancesStore()
const { locale } = useI18n()

const today = computed(() =>
  new Date().toLocaleDateString(locale.value, { weekday: 'long', month: 'short', day: 'numeric' }),
)

let viewed = false
onMounted(() => {
  instances.ensureLoaded()
  if (!viewed) {
    viewed = true
    track('home_view')
  }
})
</script>
