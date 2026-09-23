<template>
  <nav class="flex h-full w-[76px] shrink-0 flex-col items-center gap-1.5 py-4">
    <LayoutSidebarItem v-for="item in primary" :key="item.to" v-bind="item" />
    <div class="flex-1" />
    <LayoutSidebarItem to="/settings" icon="i-lucide-settings" label="nav.settings" />
  </nav>
</template>

<script setup lang="ts">
const primary = [
  { to: '/', icon: 'i-lucide-house', label: 'nav.home', exact: true },
  { to: '/instances', icon: 'i-lucide-layers', label: 'nav.instances', match: ['/instances', '/instance/'] },
  { to: '/social', icon: 'i-lucide-users', label: 'nav.social' },
  { to: '/worlds', icon: 'i-lucide-globe', label: 'nav.worlds' },
  { to: '/screenshots', icon: 'i-lucide-camera', label: 'nav.screenshots' },
  { to: '/skins', icon: 'i-lucide-shirt', label: 'nav.skins' },
]
</script>
