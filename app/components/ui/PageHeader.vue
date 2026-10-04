<template>
  <header class="mb-7 flex flex-wrap items-end justify-between gap-4">
    <div class="min-w-0">
      <h1 class="sw-page-title">{{ title }}</h1>
      <p v-if="subtitle" class="mt-3 text-sm text-muted">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.default" class="flex flex-wrap items-center gap-2">
      <slot />
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{ title: string, subtitle?: string }>()
</script>
