<template>
  <div
    class="flex items-center justify-between gap-6 py-3.5 first:pt-0 last:pb-0"
    :class="stacked ? 'flex-col items-stretch gap-3' : ''"
  >
    <div class="min-w-0">
      <p class="flex items-center gap-2 text-[13px] font-medium text-highlighted">
        {{ label }}
        <slot name="badge" />
      </p>
      <p v-if="description" class="mt-0.5 text-xs leading-relaxed text-muted">{{ description }}</p>
    </div>
    <div class="shrink-0" :class="stacked ? 'w-full' : ''">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ label: string, description?: string, stacked?: boolean }>()
</script>
