<template>
  <nav class="sw-rail" :aria-label="$t('nav.home')">
    <UTooltip v-for="item in top" :key="item.to" :text="`${$t(item.label)}  ·  ${item.key}`" :content="{ side: 'right', sideOffset: 10 }">
      <NuxtLink
        :to="item.to"
        class="sw-rail-item"
        :class="{ 'is-active': isActive(item) }"
        :aria-label="$t(item.label)"
        :aria-current="isActive(item) ? 'page' : undefined"
      >
        <UIcon :name="item.icon" class="size-[20px]" />
      </NuxtLink>
    </UTooltip>

    <div class="flex-1" />

    <!-- Zip lives at the bottom of the rail, his tips pop up beside him -->
    <ZipCompanion />

    <div class="mx-auto my-2 h-px w-9 bg-[var(--sw-line)]" />

    <UTooltip v-for="item in bottom" :key="item.to" :text="`${$t(item.label)}  ·  ${item.key}`" :content="{ side: 'right', sideOffset: 10 }">
      <NuxtLink
        :to="item.to"
        class="sw-rail-item"
        :class="{ 'is-active': isActive(item) }"
        :aria-label="$t(item.label)"
        :aria-current="isActive(item) ? 'page' : undefined"
      >
        <UIcon :name="item.icon" class="size-[20px]" />
        <span v-if="item.to === '/social' && requests" class="sw-rail-badge">{{ requests > 9 ? '9+' : requests }}</span>
      </NuxtLink>
    </UTooltip>

    <div class="mx-auto my-2 h-px w-9 bg-[var(--sw-line)]" />

    <!-- The player: their head, with the dot of a signed-in account -->
    <UTooltip :text="accounts.activeAccount?.username ?? $t('account.signIn')" :content="{ side: 'right', sideOffset: 10 }">
      <NuxtLink to="/skins" class="sw-rail-avatar" :aria-label="accounts.activeAccount?.username ?? $t('account.signIn')">
        <AccountAvatar :account="accounts.activeAccount" :face="face" class="size-9 rounded-[9px]" />
        <span v-if="accounts.activeAccount" class="sw-rail-dot" />
      </NuxtLink>
    </UTooltip>
  </nav>
</template>

<script setup lang="ts">
interface Item { to: string, icon: string, label: string, key: number, exact?: boolean, match?: string[], bottom?: boolean }

// `key` is the number shortcut: press 1–8 anywhere to jump there.
const items: Item[] = [
  { to: '/', icon: 'i-lucide-house', label: 'nav.home', key: 1, exact: true },
  { to: '/instances', icon: 'i-lucide-layout-grid', label: 'nav.instances', key: 2, match: ['/instances', '/instance/'] },
  { to: '/social', icon: 'i-lucide-users', label: 'nav.social', key: 3, bottom: true },
  { to: '/servers', icon: 'i-lucide-server', label: 'nav.servers', key: 4 },
  { to: '/worlds', icon: 'i-lucide-globe', label: 'nav.worlds', key: 5 },
  { to: '/screenshots', icon: 'i-lucide-camera', label: 'nav.screenshots', key: 6 },
  { to: '/skins', icon: 'i-lucide-shirt', label: 'nav.skins', key: 7 },
  { to: '/settings', icon: 'i-lucide-settings-2', label: 'nav.settings', key: 8, bottom: true },
]
const top = items.filter(i => !i.bottom)
const bottom = items.filter(i => i.bottom)

const route = useRoute()
const router = useRouter()
const accounts = useAccountStore()
const social = useSocialStore()
const face = usePlayerFace()

const requests = computed(() => social.friends.filter(f => f.status === 'pending_in').length)

function isActive(item: Item) {
  if (item.exact) return route.path === item.to
  return (item.match ?? [item.to]).some(p => route.path.startsWith(p))
}

function onKey(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
  const target = e.target as HTMLElement | null
  if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
  const item = items.find(i => String(i.key) === e.key)
  if (item) router.push(item.to)
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  social.ensureLoaded()
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// A clicked icon keeps the focus, and its tooltip would stay open on the next page
watch(() => route.path, () => {
  const el = document.activeElement as HTMLElement | null
  if (el?.closest('.sw-rail')) el.blur()
})
</script>

<style scoped>
.sw-rail {
  display: flex;
  width: 76px;
  flex-shrink: 0;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  position: relative;
  z-index: 20;
  padding: 14px 0 16px;
  background: var(--sw-stage);
  border-right: 1px solid var(--sw-line);
}
.sw-rail-item {
  position: relative;
  display: flex;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  color: var(--ui-text-muted);
  transition: background-color 160ms var(--ease-swift), color 160ms var(--ease-swift);
}
.sw-rail-item:hover {
  color: var(--ui-text-highlighted);
  background: var(--sw-surface-2);
}
.sw-rail-item.is-active {
  color: var(--ui-text-highlighted);
  background: var(--sw-surface-2);
}
.sw-rail-item.is-active::before {
  content: '';
  position: absolute;
  left: -16px;
  top: 10px;
  bottom: 10px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--sw-accent);
  box-shadow: 0 0 12px var(--sw-accent);
}
.sw-rail-badge {
  position: absolute;
  top: 3px;
  right: 1px;
  display: flex;
  min-width: 17px;
  height: 17px;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--sw-accent);
  color: var(--sw-accent-fg);
  font-size: 10px;
  font-weight: 800;
  box-shadow: 0 0 0 2px var(--sw-stage);
}
.sw-rail-avatar {
  position: relative;
  display: flex;
  flex-shrink: 0;
  border-radius: 10px;
  transition: transform 160ms var(--ease-swift);
}
.sw-rail-avatar:hover {
  transform: translateY(-1px);
}
.sw-rail-dot {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 11px;
  height: 11px;
  border-radius: 999px;
  background: var(--sw-success);
  box-shadow: 0 0 0 2px var(--sw-stage);
}
</style>
