<template>
  <nav class="sw-sidebar" :aria-label="$t('nav.home')">
    <NuxtLink
      v-for="(item, i) in items"
      :key="item.to"
      :to="item.to"
      class="sw-nav"
      :class="{ 'is-active': isActive(item) }"
      :aria-current="isActive(item) ? 'page' : undefined"
    >
      <UIcon :name="item.icon" class="size-[18px] shrink-0" />
      <span class="min-w-0 flex-1 truncate">{{ $t(item.label) }}</span>
      <kbd class="sw-nav-key">{{ i + 1 }}</kbd>
    </NuxtLink>

    <!-- Recent instances: one click selects it and opens Home with its Play dock -->
    <template v-if="recent.length">
      <p class="sw-eyebrow mt-6 mb-2 px-3">{{ $t('nav.recent') }}</p>
      <button
        v-for="inst in recent"
        :key="inst.id"
        type="button"
        class="sw-inst"
        :class="{ 'is-active': inst.id === instances.selectedId }"
        @click="pick(inst.id)"
      >
        <InstanceIcon :instance="inst" class="size-9 shrink-0 rounded-[9px] text-sm" />
        <span class="min-w-0 flex-1 text-left">
          <span class="block truncate text-[13px] font-semibold text-highlighted">{{ inst.name }}</span>
          <span class="block truncate text-[11.5px] text-dimmed">{{ loaderLabel(inst.loader.type) }} {{ inst.mc_version }}</span>
        </span>
      </button>
    </template>

    <div class="flex-1" />

    <!-- Zip lives at the bottom of the sidebar, his tips pop up above him -->
    <ZipCompanion />

    <button type="button" class="sw-nav mt-2" @click="createModal.open()">
      <UIcon name="i-lucide-plus" class="size-[18px] shrink-0" />
      <span class="min-w-0 flex-1 truncate">{{ $t('nav.newInstance') }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
interface Item { to: string, icon: string, label: string, exact?: boolean, match?: string[] }

// Order is the number key: press 1–8 anywhere to jump there.
const items: Item[] = [
  { to: '/', icon: 'i-lucide-house', label: 'nav.home', exact: true },
  { to: '/instances', icon: 'i-lucide-layout-grid', label: 'nav.instances', match: ['/instances', '/instance/'] },
  { to: '/social', icon: 'i-lucide-users', label: 'nav.social' },
  { to: '/servers', icon: 'i-lucide-server', label: 'nav.servers' },
  { to: '/worlds', icon: 'i-lucide-globe', label: 'nav.worlds' },
  { to: '/screenshots', icon: 'i-lucide-camera', label: 'nav.screenshots' },
  { to: '/skins', icon: 'i-lucide-shirt', label: 'nav.skins' },
  { to: '/settings', icon: 'i-lucide-settings-2', label: 'nav.settings' },
]

const route = useRoute()
const router = useRouter()
const instances = useInstancesStore()
const createModal = useCreateInstanceModal()

const recent = computed(() =>
  [...instances.instances]
    .sort((a, b) => (b.last_played ?? '').localeCompare(a.last_played ?? ''))
    .slice(0, 4),
)

function isActive(item: Item) {
  if (item.exact) return route.path === item.to
  return (item.match ?? [item.to]).some(p => route.path.startsWith(p))
}

function pick(id: string) {
  instances.select(id)
  if (route.path !== '/') router.push('/')
}

function onKey(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
  const target = e.target as HTMLElement | null
  if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
  const n = Number(e.key)
  const item = Number.isInteger(n) ? items[n - 1] : undefined
  if (item) router.push(item.to)
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
.sw-sidebar {
  display: flex;
  width: 240px;
  flex-shrink: 0;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
  padding: 16px 12px 16px;
  background: var(--sw-stage);
  border-right: 1px solid var(--sw-line);
}
.sw-nav {
  position: relative;
  display: flex;
  height: 40px;
  align-items: center;
  gap: 12px;
  padding: 0 12px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-text-muted);
  transition: background-color 160ms var(--ease-swift), color 160ms var(--ease-swift);
}
.sw-nav:hover {
  color: var(--ui-text-highlighted);
  background: var(--sw-surface-2);
}
.sw-nav.is-active {
  color: var(--ui-text-highlighted);
  background: var(--sw-accent-soft);
}
.sw-nav.is-active::before {
  content: '';
  position: absolute;
  left: -12px;
  top: 10px;
  bottom: 10px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--sw-accent);
  box-shadow: 0 0 12px var(--sw-accent);
}
.sw-nav.is-active :deep(.iconify) {
  color: var(--sw-accent);
}
.sw-nav-key {
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--ui-text-dimmed);
  opacity: 0;
  transition: opacity 160ms var(--ease-swift);
}
.sw-nav:hover .sw-nav-key {
  opacity: 1;
}
.sw-inst {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 9px;
  border-radius: 12px;
  border: 1px solid transparent;
  transition: background-color 160ms var(--ease-swift), border-color 160ms var(--ease-swift);
}
.sw-inst:hover {
  background: var(--sw-surface-2);
}
.sw-inst.is-active {
  background: var(--sw-accent-soft);
  border-color: color-mix(in srgb, var(--sw-accent) 40%, transparent);
}
</style>
