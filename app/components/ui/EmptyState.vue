<template>
  <div class="flex flex-col items-center justify-center px-6 py-16 text-center">
    <!-- Zip waits next to a little sign carrying the state's icon -->
    <div class="mb-5 flex items-end gap-3">
      <BrandMascot class="h-[90px] w-auto" />
      <div class="sw-block-flat sw-bob mb-12 flex size-11 items-center justify-center">
        <UIcon :name="icon" class="size-6 text-primary" />
      </div>
    </div>
    <p class="font-display text-xl font-semibold text-highlighted">{{ title }}</p>
    <p v-if="description" class="mt-1 max-w-sm text-sm text-muted">{{ description }}</p>
    <div v-if="$slots.default" class="mt-5 flex flex-wrap justify-center gap-2">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ icon: string, title: string, description?: string }>()
</script>
