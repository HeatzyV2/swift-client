<template>
  <section class="sw-settings-card mb-4">
    <h3 v-if="title" class="sw-eyebrow mb-3">{{ title }}</h3>
    <div class="divide-y divide-[var(--sw-line-soft)]">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{ title?: string }>()
</script>
