<template>
  <section class="relative flex flex-col items-center gap-4 overflow-hidden px-5 pb-5" :class="part === 'identity' ? 'sw-glass rounded-[20px] pt-6' : 'sw-block pt-7'">
    <!-- Accent glow behind the avatar -->
    <div v-if="part !== 'stats'" class="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(60%_100%_at_50%_0%,color-mix(in_srgb,var(--sw-accent)_28%,transparent),transparent)]" aria-hidden="true" />

    <template v-if="part !== 'stats'">
    <!-- The avatar: the player's head, big and sharp, floating -->
    <div class="sw-avatar">
      <img v-if="face" :src="face" alt="" draggable="false" class="size-full [image-rendering:pixelated]">
      <span v-else class="font-display text-[56px] font-bold text-toned">{{ initial }}</span>
    </div>

    <div class="flex flex-col items-center gap-2 text-center">
      <p class="max-w-[240px] truncate text-[24px] font-extrabold leading-none tracking-[-0.02em] text-highlighted">
        {{ account?.username ?? $t('account.signIn') }}
      </p>
      <span v-if="account" class="rounded-[6px] bg-primary px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em] sw-on-accent">
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
    </template>

    <template v-if="part !== 'identity'">

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

    </template>

    <div v-if="part !== 'stats'" class="flex w-full gap-2">
      <UButton to="/skins" color="neutral" variant="soft" icon="i-lucide-user-round" :label="$t('nav.skins')" class="flex-1 justify-center" />
      <UButton icon="i-lucide-trophy" :label="$t('swiftx.stats.share')" class="flex-1 justify-center" @click="cardOpen = true" />
    </div>
    <UButton
      v-if="!account && part !== 'stats'"
      :to="{ path: '/settings', query: { section: 'accounts' } }"
      icon="i-lucide-user-plus"
      :label="$t('home.welcome.addAccount')"
      class="w-full justify-center"
    />
  </section>
</template>

<script setup lang="ts">
/** `identity`: head, name, level and buttons (Home scene). `stats`: statistics and badges. Default: everything. */
withDefaults(defineProps<{ part?: 'all' | 'identity' | 'stats' }>(), { part: 'all' })

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
/* The player's head, framed with the accent and floating gently */
.sw-avatar {
  position: relative;
  display: flex;
  width: 128px;
  height: 128px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--sw-surface-3);
  border-radius: 28px;
  box-shadow:
    0 0 0 3px var(--sw-accent),
    0 0 0 7px var(--sw-accent-soft),
    0 18px 40px -10px color-mix(in srgb, var(--sw-accent) 55%, transparent);
  animation: sw-avatar-float 3.6s ease-in-out infinite;
  will-change: transform;
}
@keyframes sw-avatar-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
.sw-xp {
  display: flex;
  gap: 3px;
}
.sw-xp-cell {
  height: 8px;
  flex: 1;
  border-radius: 999px;
  background: var(--sw-surface-3);
}
.sw-xp-cell.is-lit {
  background: var(--sw-accent);
  box-shadow: 0 0 8px color-mix(in srgb, var(--sw-accent) 55%, transparent);
}
.sw-badge {
  display: flex;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  border-radius: 10px;
  border: 1px solid var(--sw-line);
}
.sw-badge.is-earned {
  background: var(--sw-surface-3);
  box-shadow: var(--shadow-sm);
}
.sw-badge.is-locked {
  background: var(--sw-surface);
  filter: grayscale(1);
  opacity: 0.3;
}
</style>
