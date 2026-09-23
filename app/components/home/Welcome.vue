<template>
  <section class="relative flex min-h-[460px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-default bg-[var(--sw-surface)] px-8 py-16 text-center">
    <div class="pointer-events-none absolute left-1/2 top-0 size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(46_124_255/0.14),transparent)]" />

    <BrandMark class="relative size-14 text-primary" />
    <h1 class="relative mt-6 font-display text-[32px] font-semibold text-highlighted">{{ $t('home.welcome.title') }}</h1>
    <p class="relative mt-2 max-w-md text-[15px] text-muted">{{ $t('home.welcome.text') }}</p>

    <div class="relative mt-8 flex flex-wrap justify-center gap-2">
      <UButton size="lg" icon="i-lucide-plus" :label="$t('home.welcome.create')" @click="openCreate()" />
      <UButton size="lg" color="neutral" variant="soft" icon="i-lucide-package" :label="$t('home.actions.modpacks')" @click="browser.open({ kind: 'modpack', mode: 'createModpack' })" />
    </div>

    <p v-if="accounts.loaded && !accounts.activeAccount" class="relative mt-8 flex items-center gap-2 text-sm text-warning">
      <UIcon name="i-lucide-user-x" class="size-4" />
      {{ $t('home.status.noAccount') }}
      <NuxtLink :to="{ path: '/settings', query: { section: 'accounts' } }" class="font-medium text-highlighted underline-offset-4 hover:underline">
        {{ $t('home.welcome.addAccount') }}
      </NuxtLink>
    </p>
  </section>
</template>

<script setup lang="ts">
const accounts = useAccountStore()
const browser = useContentWindow()
const { open: openCreate } = useCreateInstanceModal()
</script>
