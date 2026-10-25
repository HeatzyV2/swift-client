<template>
  <!-- Page header shared by every page: icon tile, big condensed title, one line under it, actions on the right -->
  <header class="sw-rise-in mb-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
    <div class="flex min-w-0 items-center gap-4">
      <span v-if="icon" class="sw-settings-icon size-12! rounded-[13px]!">
        <UIcon :name="icon" class="size-6" />
      </span>
      <div class="min-w-0">
        <h1 class="sw-page-title truncate">{{ title }}</h1>
        <p v-if="subtitle" class="mt-1.5 text-[13.5px] text-muted">{{ subtitle }}</p>
      </div>
    </div>
    <div v-if="$slots.default" class="flex flex-wrap items-center gap-2">
      <slot />
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{ title: string, subtitle?: string, icon?: string }>()
</script>
