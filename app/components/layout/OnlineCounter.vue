<template>
  <!-- Swift players in game right now, from the online service -->
  <p class="flex items-center gap-2.5 text-[14px] font-bold text-[var(--sw-success)]">
    <span class="relative flex size-2.5">
      <span class="absolute inset-0 animate-ping rounded-full bg-[var(--sw-success)] opacity-50 [animation-duration:2.4s]" />
      <span class="relative size-2.5 rounded-full bg-[var(--sw-success)] shadow-[0_0_10px_var(--sw-success)]" />
    </span>
    <i18n-t keypath="topbar.playersOnline" :plural="count" tag="span">
      <template #n><span class="tabular-nums">{{ count.toLocaleString(locale) }}</span></template>
    </i18n-t>
  </p>
</template>

<script setup lang="ts">
defineProps<{ count: number }>()
const { locale } = useI18n()
</script>
