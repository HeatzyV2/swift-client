<template>
  <section class="sw-settings-card mb-5">
    <header v-if="title || $slots.actions" class="mb-4 flex items-start justify-between gap-4">
      <div class="flex min-w-0 items-center gap-3">
        <span v-if="icon" class="sw-settings-icon">
          <UIcon :name="icon" class="size-[18px]" />
        </span>
        <div class="min-w-0">
          <h3 class="text-[15px] font-semibold text-highlighted">{{ title }}</h3>
          <p v-if="description" class="mt-0.5 text-[12.5px] leading-relaxed text-muted">{{ description }}</p>
        </div>
      </div>
      <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2">
        <slot name="actions" />
      </div>
    </header>
    <div class="divide-y divide-[var(--sw-line-soft)]">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{ title?: string, description?: string, icon?: string }>()
</script>
