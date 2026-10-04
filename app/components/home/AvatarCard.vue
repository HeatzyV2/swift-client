<template>
  <section class="sw-block relative flex flex-col items-center gap-5 overflow-hidden px-5 pb-5 pt-7">
    <!-- Speed streak across the top edge -->
    <div class="absolute inset-x-0 top-0 flex h-[7px]" aria-hidden="true">
      <span class="h-full flex-[6] bg-primary" />
      <span class="h-full w-[6px]" />
      <span class="h-full flex-[2] bg-primary/60" />
      <span class="h-full w-[6px]" />
      <span class="h-full flex-1 bg-primary/30" />
    </div>

    <!-- The avatar: the player's head, big and sharp, framed like a sticker -->
    <div class="sw-avatar sw-bob">
      <img v-if="face" :src="face" alt="" draggable="false" class="size-full [image-rendering:pixelated]">
      <span v-else class="font-display text-[56px] font-bold text-toned">{{ initial }}</span>
    </div>

    <div class="flex flex-col items-center gap-2 text-center">
      <p class="sw-sign-text max-w-[240px] truncate text-[28px] font-semibold leading-none text-highlighted">
        {{ account?.username ?? $t('account.signIn') }}
      </p>
      <span v-if="account" class="bg-primary px-2 py-0.5 font-display text-[12px] uppercase tracking-[0.12em] sw-on-accent">
        {{ $t(`account.kind.${account.kind}`) }}
      </span>
    </div>

    <!-- Stats, like the game's own statistics screen -->
    <dl class="w-full space-y-2">
      <div class="sw-block-flat flex items-center justify-between px-3 py-2">
        <dt class="sw-eyebrow">{{ $t('instance.playtime') }}</dt>
        <dd class="font-display text-[18px] font-semibold tabular-nums text-highlighted">{{ totalPlaytime }}</dd>
      </div>
      <div class="sw-block-flat flex items-center justify-between px-3 py-2">
        <dt class="sw-eyebrow">{{ $t('nav.instances') }}</dt>
        <dd class="font-display text-[18px] font-semibold tabular-nums text-highlighted">{{ instances.instances.length }}</dd>
      </div>
      <div class="sw-block-flat flex items-center justify-between gap-3 px-3 py-2">
        <dt class="sw-eyebrow shrink-0">{{ $t('nav.lastPlayed') }}</dt>
        <dd class="truncate font-display text-[16px] font-semibold text-highlighted">{{ lastPlayed ?? $t('instance.neverPlayed') }}</dd>
      </div>
    </dl>

    <div class="flex w-full gap-2">
      <UButton to="/skins" color="neutral" variant="soft" icon="i-pixelarticons-human" :label="$t('nav.skins')" class="flex-1 justify-center" />
      <UButton
        v-if="!account"
        :to="{ path: '/settings', query: { section: 'accounts' } }"
        icon="i-pixelarticons-user-plus"
        :label="$t('home.welcome.addAccount')"
        class="flex-1 justify-center"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
const accounts = useAccountStore()
const instances = useInstancesStore()
const { locale } = useI18n()

const account = computed(() => accounts.activeAccount)
const initial = computed(() => account.value?.username.charAt(0).toUpperCase() ?? '?')

// Only a real skin gives a face; the fallback skin is not the player's own.
const { skin, isDefault } = usePlayerSkin()
const face = ref<string | null>(null)
watch([skin, isDefault], async ([s, fallback]) => {
  face.value = s && !fallback ? await skinFace(s.src).catch(() => null) : null
}, { immediate: true })

const totalPlaytime = computed(() =>
  formatPlaytime(instances.instances.reduce((sum, i) => sum + (i.playtime_seconds ?? 0), 0), locale.value),
)

const lastPlayed = computed(() => {
  const newest = [...instances.instances]
    .filter(i => i.last_played)
    .sort((a, b) => (b.last_played ?? '').localeCompare(a.last_played ?? ''))[0]
  return formatRelative(newest?.last_played, locale.value)
})
</script>

<style scoped>
/* A 3D-less sticker: thick ink frame, solid side, a slight tilt */
.sw-avatar {
  display: flex;
  width: 148px;
  height: 148px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--sw-surface-3);
  border: 4px solid var(--sw-ink);
  border-radius: 4px;
  box-shadow:
    0 0 0 3px var(--sw-accent),
    0 9px 0 3px var(--sw-ink),
    0 12px 0 3px var(--sw-block-side);
  rotate: -2.5deg;
}
</style>
