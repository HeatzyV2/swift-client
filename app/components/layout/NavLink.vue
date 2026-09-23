<template>
  <NuxtLink
    :to="to"
    class="group relative flex h-9 items-center gap-3 rounded-md px-3 text-[13px] font-medium transition-colors"
    :class="active ? 'bg-[var(--sw-surface-2)] text-highlighted' : 'text-muted hover:bg-white/[0.03] hover:text-toned'"
  >
    <span
      class="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-primary transition-opacity duration-150"
      :class="active ? 'opacity-100' : 'opacity-0'"
    />
    <UIcon :name="icon" class="size-[18px] shrink-0 transition-colors" :class="active ? 'text-primary' : 'text-dimmed group-hover:text-muted'" />
    <span>{{ $t(label) }}</span>
  </NuxtLink>
</template>

<script setup lang="ts">
const props = defineProps<{ to: string, icon: string, label: string, exact?: boolean }>()
const route = useRoute()

const active = computed(() => {
  if (props.exact) return route.path === props.to
  if (props.to === '/instances') return route.path.startsWith('/instances') || route.path.startsWith('/instance/')
  return route.path.startsWith(props.to)
})
</script>
