<template>
  <div class="flex h-screen flex-col items-center justify-center gap-5 bg-[var(--sw-canvas)] px-8 text-center">
    <BrandMark class="size-10 text-primary" />
    <div>
      <h1 class="font-display text-xl font-semibold text-highlighted">{{ $t('appError.title') }}</h1>
      <p class="mt-2 max-w-md text-sm text-muted">{{ $t('appError.text') }}</p>
      <p v-if="error?.message" class="mt-4 max-w-lg break-words font-mono text-xs text-dimmed">{{ error.message }}</p>
    </div>
    <UButton icon="i-lucide-rotate-cw" :label="$t('appError.reload')" @click="reload" />
  </div>
</template>

<script setup lang="ts">
defineProps<{ error: { message?: string } | null }>()

const reload = () => clearError({ redirect: '/' })
</script>
