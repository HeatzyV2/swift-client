<template>
  <nav class="sw-hotbar" :aria-label="$t('nav.home')">
    <NuxtLink
      v-for="(item, i) in items"
      :key="item.to"
      :to="item.to"
      :aria-label="$t(item.label)"
      class="sw-slot"
      :class="{ 'is-active': isActive(item) }"
    >
      <UTooltip :text="$t(item.label)" :content="{ side: 'top', sideOffset: 16 }" :delay-duration="100">
        <span class="sw-slot-inner">
          <UIcon :name="item.icon" class="sw-slot-icon" />
        </span>
      </UTooltip>
      <span class="sw-slot-key">{{ i + 1 }}</span>
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
interface Item { to: string, icon: string, label: string, exact?: boolean, match?: string[] }

// Order is the number key: press 1–8 anywhere to jump, like a Minecraft hotbar.
const items: Item[] = [
  { to: '/', icon: 'i-pixelarticons-home', label: 'nav.home', exact: true },
  { to: '/instances', icon: 'i-pixelarticons-layout-glyph', label: 'nav.instances', match: ['/instances', '/instance/'] },
  { to: '/social', icon: 'i-pixelarticons-users', label: 'nav.social' },
  { to: '/servers', icon: 'i-pixelarticons-server', label: 'nav.servers' },
  { to: '/worlds', icon: 'i-pixelarticons-globe', label: 'nav.worlds' },
  { to: '/screenshots', icon: 'i-pixelarticons-camera', label: 'nav.screenshots' },
  { to: '/skins', icon: 'i-pixelarticons-human', label: 'nav.skins' },
  { to: '/settings', icon: 'i-pixelarticons-sliders', label: 'nav.settings' },
]

const route = useRoute()
const router = useRouter()

function isActive(item: Item) {
  if (item.exact) return route.path === item.to
  return (item.match ?? [item.to]).some(p => route.path.startsWith(p))
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
.sw-hotbar {
  position: fixed;
  left: 50%;
  bottom: 14px;
  z-index: 60;
  display: flex;
  translate: -50% 0;
  padding: 4px;
  gap: 4px;
  background: var(--sw-surface-2);
  border: 3px solid var(--sw-ink);
  border-radius: 4px;
  box-shadow:
    inset 0 3px 0 rgb(255 255 255 / 0.07),
    inset 0 -3px 0 rgb(0 0 0 / 0.35),
    0 6px 0 0 var(--sw-block-side);
}
.sw-slot {
  position: relative;
  display: block;
  width: 56px;
  height: 56px;
  background: var(--sw-surface);
  border: 3px solid var(--sw-line-strong);
  border-radius: 2px;
  color: var(--ui-text-dimmed);
  transition: transform 80ms steps(2), color 80ms steps(2), background-color 80ms steps(2);
}
.sw-slot:hover {
  color: var(--ui-text-highlighted);
  background: var(--sw-surface-3);
  transform: translateY(-3px);
}
.sw-slot:active {
  transform: translateY(2px);
}
/* The selected slot: white frame, exactly like the game's hotbar cursor */
.sw-slot.is-active {
  z-index: 1;
  color: var(--sw-accent);
  background: var(--sw-surface-3);
  border-color: #ffffff;
  box-shadow: 0 0 0 3px var(--sw-ink), inset 0 0 0 2px var(--sw-ink);
  transform: translateY(-4px);
}
.sw-slot-inner {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
}
.sw-slot-icon {
  width: 28px;
  height: 28px;
}
.sw-slot-key {
  position: absolute;
  right: 3px;
  bottom: 0;
  font-family: var(--font-display);
  font-size: 12px;
  line-height: 1.2;
  color: var(--ui-text-muted);
  text-shadow: 1px 1px 0 var(--sw-ink);
  pointer-events: none;
}
.sw-slot.is-active .sw-slot-key {
  color: #ffffff;
}
</style>
