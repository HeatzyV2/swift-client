<template>
  <span class="inline-flex items-center gap-2 select-none">
    <BrandMark class="size-5 shrink-0 text-primary" />
    <span class="font-display text-[13px] font-bold uppercase tracking-[0.18em] text-highlighted">
      {{ BRAND.shortName }}<span v-if="!compact" class="ml-1.5 font-medium text-dimmed">Client</span>
    </span>
  </span>
</template>

<script setup lang="ts">
import { BRAND } from '~/utils/brand'

defineProps<{ compact?: boolean }>()
</script>
