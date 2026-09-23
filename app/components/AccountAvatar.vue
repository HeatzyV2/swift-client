<template>
  <span class="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-[var(--sw-surface-3)]">
    <img
      v-if="src && !failed"
      :src="src"
      alt=""
      class="size-full [image-rendering:pixelated]"
      draggable="false"
      @error="failed = true"
    >
    <span v-else-if="account" class="font-display text-xs font-bold text-toned">{{ account.username.charAt(0).toUpperCase() }}</span>
    <UIcon v-else name="i-lucide-user-round" class="size-4 text-dimmed" />
  </span>
</template>

<script setup lang="ts">
import type { Account } from '~/types/launcher'

const props = defineProps<{ account?: Account | null }>()
const failed = ref(false)

// Offline accounts have no real skin, so only Microsoft accounts get a face.
const src = computed(() =>
  props.account?.kind === 'microsoft' ? `https://crafatar.com/avatars/${props.account.uuid}?size=64&overlay` : null,
)

watch(() => props.account?.uuid, () => { failed.value = false })
</script>
