<template>
  <UTooltip :text="$t(label)" :content="{ side: 'right', sideOffset: 10 }" :delay-duration="150">
    <NuxtLink
      :to="to"
      :aria-label="$t(label)"
      class="group relative flex size-12 items-center justify-center rounded-xl transition-colors duration-150"
      :class="active ? 'bg-[var(--sw-surface-2)] text-highlighted' : 'text-dimmed hover:bg-[var(--sw-surface)] hover:text-toned'"
    >
      <span
        class="absolute -left-[14px] top-1/2 w-[3px] -translate-y-1/2 rounded-r-full bg-primary transition-all duration-200 ease-[var(--ease-swift)]"
        :class="active ? 'h-6 opacity-100' : 'h-0 opacity-0'"
      />
      <UIcon :name="icon" class="size-[21px] transition-transform duration-150 group-hover:scale-105" :class="active ? 'text-primary' : ''" />
    </NuxtLink>
  </UTooltip>
</template>

<script setup lang="ts">
const props = defineProps<{ to: string, icon: string, label: string, exact?: boolean, match?: string[] }>()
const route = useRoute()

const active = computed(() => {
  if (props.exact) return route.path === props.to
  const prefixes = props.match ?? [props.to]
  return prefixes.some(p => route.path.startsWith(p))
})
</script>
