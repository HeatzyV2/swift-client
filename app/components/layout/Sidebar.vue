<template>
  <aside class="flex h-full w-[232px] shrink-0 flex-col border-r border-default px-3 pb-3 pt-2">
    <nav class="flex flex-col gap-0.5">
      <LayoutNavLink v-for="item in primary" :key="item.to" v-bind="item" />
    </nav>

    <div class="mt-6 flex min-h-0 flex-1 flex-col">
      <div class="mb-1.5 flex items-center justify-between px-3">
        <span class="sw-eyebrow">{{ $t('nav.recent') }}</span>
        <UTooltip :text="$t('nav.newInstance')">
          <UButton icon="i-lucide-plus" size="xs" color="neutral" variant="ghost" square :aria-label="$t('nav.newInstance')" @click="openCreate()" />
        </UTooltip>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto">
        <template v-if="!instances.loaded">
          <div v-for="n in 4" :key="n" class="flex items-center gap-2.5 px-3 py-1.5">
            <div class="sw-skeleton size-6 shrink-0" />
            <div class="sw-skeleton h-3 flex-1" />
          </div>
        </template>
        <p v-else-if="!recent.length" class="px-3 py-2 text-xs text-dimmed">{{ $t('nav.noRecent') }}</p>
        <NuxtLink
          v-for="inst in recent"
          v-else
          :key="inst.id"
          :to="`/instance/${inst.id}`"
          class="group flex items-center gap-2.5 rounded-md px-3 py-1.5 transition-colors"
          :class="route.params.id === inst.id ? 'bg-[var(--sw-surface-2)] text-highlighted' : 'text-muted hover:bg-white/[0.03] hover:text-toned'"
        >
          <InstanceIcon :instance="inst" class="size-6 rounded text-[11px]" />
          <span class="min-w-0 flex-1 truncate text-[13px]">{{ inst.name }}</span>
          <span v-if="isRunning(inst.id)" class="size-1.5 shrink-0 rounded-full bg-[var(--sw-success)]" :title="$t('instance.running')" />
        </NuxtLink>
      </div>
    </div>

    <div class="mt-3 flex flex-col gap-0.5 border-t border-default pt-3">
      <LayoutNavLink to="/settings" icon="i-lucide-settings-2" label="nav.settings" />
      <LayoutAccountMenu class="mt-1" />
    </div>
  </aside>
</template>

<script setup lang="ts">
const instances = useInstancesStore()
const activity = useActivityCenter()
const route = useRoute()
const { open: openCreate } = useCreateInstanceModal()

const primary = [
  { to: '/', icon: 'i-lucide-house', label: 'nav.home', exact: true },
  { to: '/instances', icon: 'i-lucide-layers', label: 'nav.instances' },
  { to: '/worlds', icon: 'i-lucide-globe', label: 'nav.worlds' },
  { to: '/screenshots', icon: 'i-lucide-image', label: 'nav.screenshots' },
  { to: '/skins', icon: 'i-lucide-shirt', label: 'nav.skins' },
]

const RECENT_LIMIT = 8
const recent = computed(() => {
  const played = instances.recent
  const rest = instances.instances.filter(i => !i.last_played)
  return [...played, ...rest].slice(0, RECENT_LIMIT)
})

const isRunning = (id: string) => activity.list.value.some(a => a.instanceId === id && a.kind === 'running')
</script>
