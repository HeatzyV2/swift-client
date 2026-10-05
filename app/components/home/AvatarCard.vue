<template>
  <section class="sw-block relative flex flex-col items-center gap-4 overflow-hidden px-5 pb-5 pt-7">
    <!-- Speed streak across the top edge -->
    <div class="absolute inset-x-0 top-0 flex h-[7px]" aria-hidden="true">
      <span class="h-full flex-[6] bg-primary" />
      <span class="h-full w-[6px]" />
      <span class="h-full flex-[2] bg-primary/60" />
      <span class="h-full w-[6px]" />
      <span class="h-full flex-1 bg-primary/30" />
    </div>

    <!-- The avatar: the player's head, big and sharp, framed like a sticker -->
    <div class="sw-avatar">
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

    <!-- Level and XP: the bar is segmented like the in-game ones -->
    <div class="w-full">
      <div class="mb-1.5 flex items-baseline justify-between">
        <span class="sw-eyebrow text-primary">{{ $t('swiftx.stats.level', { n: level }) }}</span>
        <span class="font-mono text-[11px] tabular-nums text-dimmed">{{ Math.round(progress * 100) }}%</span>
      </div>
      <div class="sw-xp" role="progressbar" :aria-valuenow="Math.round(progress * 100)" aria-valuemin="0" aria-valuemax="100">
        <span v-for="i in SEGS" :key="i" class="sw-xp-cell" :class="{ 'is-lit': i <= litSegs }" />
      </div>
    </div>

    <!-- Stats, like the game's own statistics screen -->
    <dl class="w-full space-y-2">
      <div class="sw-block-flat flex items-center justify-between px-3 py-1.5">
        <dt class="sw-eyebrow">{{ $t('instance.playtime') }}</dt>
        <dd class="font-display text-[17px] font-semibold tabular-nums text-highlighted">{{ playtime }}</dd>
      </div>
      <div class="sw-block-flat flex items-center justify-between px-3 py-1.5">
        <dt class="sw-eyebrow">{{ $t('nav.instances') }}</dt>
        <dd class="font-display text-[17px] font-semibold tabular-nums text-highlighted">{{ instances.instances.length }}</dd>
      </div>
      <div class="sw-block-flat flex items-center justify-between px-3 py-1.5">
        <dt class="sw-eyebrow">{{ $t('swiftx.stats.streak') }}</dt>
        <dd class="font-display text-[17px] font-semibold tabular-nums text-highlighted">{{ $t('swiftx.stats.days', { n: streak }) }}</dd>
      </div>
      <div class="sw-block-flat flex items-center justify-between px-3 py-1.5">
        <dt class="sw-eyebrow">{{ $t('swiftx.stats.best') }}</dt>
        <dd class="font-display text-[17px] font-semibold tabular-nums text-highlighted">
          {{ stats.best === null ? $t('swiftx.stats.none') : `${(stats.best / 1000).toFixed(1)} s` }}
        </dd>
      </div>
    </dl>

    <!-- Badges: earned ones in colour, the rest waiting in the dark -->
    <div class="w-full">
      <p class="sw-eyebrow mb-1.5">{{ $t('swiftx.stats.badges') }}</p>
      <div class="flex flex-wrap gap-1.5">
        <UTooltip v-for="b in badges" :key="b.id" :text="$t(b.label)">
          <span
            class="sw-badge"
            :class="b.earned ? 'is-earned' : 'is-locked'"
            :aria-label="$t(b.label)"
          >{{ b.emoji }}</span>
        </UTooltip>
      </div>
    </div>

    <div class="flex w-full gap-2">
      <UButton to="/skins" color="neutral" variant="soft" icon="i-pixelarticons-human" :label="$t('nav.skins')" class="flex-1 justify-center" />
      <UButton icon="i-pixelarticons-trophy" :label="$t('swiftx.stats.share')" class="flex-1 justify-center" @click="cardOpen = true" />
    </div>
    <UButton
      v-if="!account"
      :to="{ path: '/settings', query: { section: 'accounts' } }"
      icon="i-pixelarticons-user-plus"
      :label="$t('home.welcome.addAccount')"
      class="w-full justify-center"
    />
  </section>
</template>

<script setup lang="ts">
const accounts = useAccountStore()
const instances = useInstancesStore()
const { locale } = useI18n()
const { cardOpen } = useCommandPalette()
const { level, progress, badges, streak, stats, totalSeconds } = usePlayerProgress()
const face = usePlayerFace()

const SEGS = 18
const litSegs = computed(() => Math.round(progress.value * SEGS))

const account = computed(() => accounts.activeAccount)
const initial = computed(() => account.value?.username.charAt(0).toUpperCase() ?? '?')
const playtime = computed(() => formatPlaytime(totalSeconds.value, locale.value))
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
  /* A slow, continuous float: smooth on purpose (the pixel sprites step, the avatar does not) */
  animation: sw-avatar-float 3.6s ease-in-out infinite;
  will-change: transform;
}
@keyframes sw-avatar-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
.sw-xp {
  display: flex;
  gap: 2px;
  padding: 3px;
  background: var(--sw-ink);
  border-radius: 2px;
}
.sw-xp-cell {
  height: 12px;
  flex: 1;
  background: var(--sw-surface-3);
}
.sw-xp-cell.is-lit {
  background: var(--sw-accent);
  box-shadow: inset 0 3px 0 rgb(255 255 255 / 0.35);
}
.sw-badge {
  display: flex;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  border: 3px solid var(--sw-ink);
  border-radius: 3px;
}
.sw-badge.is-earned {
  background: var(--sw-surface-3);
  box-shadow: 0 3px 0 0 var(--sw-block-side);
}
.sw-badge.is-locked {
  background: var(--sw-surface);
  filter: grayscale(1);
  opacity: 0.3;
}
</style>
