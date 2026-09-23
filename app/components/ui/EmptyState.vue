<template>
  <div class="flex flex-col items-center justify-center px-6 py-20 text-center">
    <div class="mb-4 flex size-12 items-center justify-center rounded-xl border border-default bg-[var(--sw-surface)]">
      <UIcon :name="icon" class="size-5 text-muted" />
    </div>
    <p class="font-display text-base font-semibold text-highlighted">{{ title }}</p>
    <p v-if="description" class="mt-1 max-w-sm text-sm text-muted">{{ description }}</p>
    <div v-if="$slots.default" class="mt-5 flex flex-wrap justify-center gap-2">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ icon: string, title: string, description?: string }>()
</script>
