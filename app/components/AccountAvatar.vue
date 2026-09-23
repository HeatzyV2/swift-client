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

/** `face` is a ready face image (e.g. cut from the active skin); otherwise Microsoft accounts use their profile head. */
const props = defineProps<{ account?: Account | null, face?: string | null }>()
const failed = ref(false)

const src = computed(() => {
  if (props.face) return props.face
  return props.account?.kind === 'microsoft' ? `https://crafatar.com/avatars/${props.account.uuid}?size=64&overlay` : null
})

watch(src, () => { failed.value = false })
</script>
