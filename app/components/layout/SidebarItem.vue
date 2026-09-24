<template>
  <UTooltip :text="$t(label)" :content="{ side: 'right', sideOffset: 10 }" :delay-duration="150">
    <NuxtLink
      :to="to"
      :aria-label="$t(label)"
      class="group relative flex size-12 items-center justify-center rounded-xl border transition-[background-color,border-color,color] duration-150"
      :class="active ? 'sw-glass text-highlighted' : 'border-transparent text-dimmed hover:bg-[var(--sw-surface)] hover:text-toned'"
    >
      <!-- Accent bar on the active icon's own left edge -->
      <span
        class="absolute -left-px top-1/2 w-[2px] -translate-y-1/2 rounded-full bg-primary shadow-[0_0_10px_var(--sw-accent)] transition-all duration-200 ease-[var(--ease-swift)]"
        :class="active ? 'h-5 opacity-100' : 'h-0 opacity-0'"
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
