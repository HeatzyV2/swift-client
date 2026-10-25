<template>
  <header
    data-tauri-drag-region
    class="fixed inset-x-0 top-0 z-[100] flex h-[60px] select-none items-center justify-between border-b border-[var(--sw-line)] bg-[var(--sw-stage)]"
    @pointerdown.self.stop
  >
    <div data-tauri-drag-region class="flex h-full min-w-0 items-center" :class="isMac ? 'pl-[84px]' : ''">
      <!-- Over the rail: the mark alone, the page title beside it -->
      <template v-if="!compact">
        <NuxtLink
          to="/"
          class="flex h-full w-[76px] shrink-0 items-center justify-center border-r border-[var(--sw-line)]"
          :class="isMac ? 'border-l' : ''"
          :aria-label="BRAND.name"
        >
          <BrandMark class="size-7 text-primary" />
        </NuxtLink>
        <LayoutOnlineCounter v-if="online !== null && OWN_HEADER.includes(route.path)" :count="online" class="ml-7" />
        <h1 v-else data-tauri-drag-region class="font-headline truncate pl-7 text-[26px] font-extrabold! uppercase leading-none text-highlighted">
          {{ title }}
        </h1>
      </template>
      <div v-else data-tauri-drag-region class="flex items-center gap-3 pl-[22px]">
        <BrandMark class="size-7 text-primary" />
        <span data-tauri-drag-region class="font-pixel text-[20px] font-bold uppercase leading-none text-highlighted">
          Swift<span class="ml-1.5 text-primary">Client</span>
        </span>
        <span class="ml-2 border-l border-default pl-3 text-xs text-dimmed">{{ $t('browserWindow.title') }}</span>
      </div>
    </div>

    <div class="flex h-full items-center gap-1.5" :class="isMac ? 'pr-4' : ''" style="-webkit-app-region: no-drag">
      <template v-if="!compact">
        <LayoutStatusChip class="mr-1.5 max-[1180px]:hidden" />
        <UTooltip :text="$t('nav.newInstance')">
          <button type="button" class="sw-top-icon" :aria-label="$t('nav.newInstance')" @click="createModal.open()">
            <UIcon name="i-lucide-plus" class="size-[18px]" />
          </button>
        </UTooltip>
        <UTooltip :text="`${$t('swiftx.palette.hint')}  ·  Ctrl K`">
          <button type="button" class="sw-top-icon" :aria-label="$t('swiftx.palette.placeholder')" @click="palette.open.value = true">
            <UIcon name="i-lucide-search" class="size-[18px]" />
          </button>
        </UTooltip>
        <UTooltip :text="$t('home.friends.requests', { n: requests })">
          <NuxtLink to="/social" class="sw-top-icon relative" :aria-label="$t('home.friends.requests', { n: requests })">
            <UIcon name="i-lucide-bell" class="size-[18px]" />
            <span v-if="requests" class="sw-top-badge">{{ requests > 9 ? '9+' : requests }}</span>
          </NuxtLink>
        </UTooltip>
        <LayoutAccountMenu class="ml-1" />
        <div class="mx-2 h-6 w-px bg-[var(--sw-line)]" />
      </template>
      <WindowControls />
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{ compact?: boolean }>()

const palette = useCommandPalette()
const createModal = useCreateInstanceModal()
const social = useSocialStore()
const route = useRoute()
const { t } = useI18n()
const { platform } = usePlatform()
const isMac = computed(() => platform.value === 'macos')

const requests = computed(() => social.friends.filter(f => f.status === 'pending_in').length)

const TITLES: [string, string][] = [
  ['/instance', 'nav.instances'],
  ['/social', 'nav.social'],
  ['/servers', 'nav.servers'],
  ['/worlds', 'nav.worlds'],
  ['/screenshots', 'nav.screenshots'],
  ['/skins', 'nav.skins'],
  ['/settings', 'nav.settings'],
]
const title = computed(() => t(TITLES.find(([p]) => route.path.startsWith(p))?.[1] ?? 'nav.home'))
/** These pages open with their own big title: the live player count takes its place here. */
const OWN_HEADER = ['/instances', '/servers', '/worlds', '/screenshots', '/skins', '/social']
const online = usePlayersOnline()
</script>

<style scoped>
.sw-top-icon {
  display: flex;
  width: 38px;
  height: 38px;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  color: var(--ui-text-muted);
  transition: color 160ms var(--ease-swift), background-color 160ms var(--ease-swift);
}
.sw-top-icon:hover {
  color: var(--ui-text-highlighted);
  background: var(--sw-surface-2);
}
.sw-top-badge {
  position: absolute;
  top: 3px;
  right: 3px;
  display: flex;
  min-width: 16px;
  height: 16px;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--sw-danger);
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  box-shadow: 0 0 0 2px var(--sw-stage);
}
</style>
