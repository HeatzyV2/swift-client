<template>
  <div
    class="flex items-center justify-between gap-6 py-4 first:pt-0 last:pb-0"
    :class="stacked ? 'flex-col items-stretch gap-3' : ''"
  >
    <div class="flex min-w-0 items-center gap-3.5">
      <slot name="icon">
        <span v-if="icon" class="sw-settings-icon sw-settings-icon-sm">
          <UIcon :name="icon" class="size-4" />
        </span>
      </slot>
      <div class="min-w-0">
        <p class="flex items-center gap-2 text-[13.5px] font-semibold text-highlighted">
          {{ label }}
          <slot name="badge" />
        </p>
        <p v-if="description" class="mt-0.5 text-[12.5px] leading-relaxed text-muted" :class="mono ? 'truncate font-mono text-[11.5px]' : ''" :title="mono ? description : undefined">{{ description }}</p>
      </div>
    </div>
    <div class="shrink-0" :class="stacked ? 'w-full' : ''">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ label: string, description?: string, icon?: string, stacked?: boolean, mono?: boolean }>()
</script>
