<template>
  <div class="w-[380px] overflow-hidden rounded-xl">
    <div class="flex items-center justify-between px-4 pb-2 pt-3.5">
      <span class="sw-eyebrow">{{ $t('home.switchInstance') }}</span>
      <span class="font-mono text-[11px] text-dimmed">{{ instances.instances.length }}</span>
    </div>

    <div v-if="instances.instances.length > 6" class="px-3 pb-2">
      <UInput v-model="query" icon="i-lucide-search" size="sm" :placeholder="$t('library.search')" class="w-full" autofocus />
    </div>

    <ul class="max-h-[340px] overflow-y-auto px-1.5 pb-1.5">
      <li v-for="inst in list" :key="inst.id">
        <button
          type="button"
          class="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors duration-150"
          :class="inst.id === instances.selectedId ? 'bg-primary/12' : 'hover:bg-[var(--sw-surface-3)]'"
          @click="pick(inst.id)"
        >
          <InstanceIcon :instance="inst" class="size-9 rounded-lg text-sm" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[13px] font-semibold" :class="inst.id === instances.selectedId ? 'text-primary' : 'text-highlighted'">{{ inst.name }}</span>
            <span class="block truncate text-[11px] text-dimmed">
              <span class="font-mono">{{ inst.mc_version }}</span> · {{ loaderLabel(inst.loader.type) }}
            </span>
          </span>
          <span class="shrink-0 text-[11px] text-dimmed">{{ formatRelative(inst.last_played, locale) ?? '—' }}</span>
          <UIcon v-if="inst.id === instances.selectedId" name="i-lucide-check" class="size-4 shrink-0 text-primary" />
        </button>
      </li>
      <li v-if="!list.length" class="px-3 py-6 text-center text-xs text-dimmed">{{ instances.instances.length ? $t('library.noResults') : $t('home.noInstances') }}</li>
    </ul>

    <div class="grid grid-cols-2 gap-1 border-t border-[var(--sw-line)] p-1.5">
      <button type="button" class="sw-switcher-action" @click="create">
        <UIcon name="i-lucide-plus" class="size-4" />{{ $t('nav.newInstance') }}
      </button>
      <NuxtLink to="/instances" class="sw-switcher-action" @click="emit('done')">
        <UIcon name="i-lucide-layers" class="size-4" />{{ $t('home.manageInstances') }}
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{ done: [] }>()

const instances = useInstancesStore()
const { locale } = useI18n()
const { open: openCreate } = useCreateInstanceModal()

const query = ref('')
const list = computed(() => {
  const q = query.value.trim().toLowerCase()
  return [...instances.instances]
    .filter(i => !q || i.name.toLowerCase().includes(q))
    .sort((a, b) => (b.last_played ?? '').localeCompare(a.last_played ?? '') || a.name.localeCompare(b.name))
})

function pick(id: string) {
  instances.select(id)
  emit('done')
}

function create() {
  emit('done')
  openCreate()
}
</script>

<style scoped>
.sw-switcher-action {
  display: flex;
  height: 36px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--ui-text-muted);
  transition: background-color 150ms, color 150ms;
}
.sw-switcher-action:hover {
  background: var(--sw-surface-3);
  color: var(--ui-text-highlighted);
}
</style>
