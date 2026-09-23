<template>
  <section class="mb-8">
    <h3 v-if="title" class="sw-eyebrow mb-1">{{ title }}</h3>
    <div class="divide-y divide-[var(--sw-line-soft)]">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{ title?: string }>()
</script>
