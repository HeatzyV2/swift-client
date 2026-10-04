<template>
  <div class="relative flex w-[min(540px,100%)] flex-col items-center gap-5 pb-2">
    <!-- Zip sprints along the top edge of the button while the game installs or launches -->
    <div v-if="state === 'installing' || state === 'launching'" class="pointer-events-none absolute inset-x-0 -top-[58px] h-[56px]">
      <div
        class="absolute bottom-0 w-[84px] transition-[left] duration-300 ease-linear"
        :style="{ left: `calc(${state === 'launching' ? 100 : (percent ?? 0)}% - ${state === 'launching' ? 84 : 42}px)` }"
      >
        <BrandMascot pose="run" class="h-[56px] w-auto" />
      </div>
    </div>
    <div class="sw-play sw-chunk sw-pop-in" :data-state="state" :data-open="switcherOpen">
      <!-- Real download progress: fills the whole control -->
      <div
        v-if="state === 'installing'"
        class="pointer-events-none absolute inset-y-0 left-0 bg-white/20 transition-[width] duration-300 ease-out"
        :style="{ width: `${percent ?? 0}%` }"
      />
      <div
        v-if="state === 'installing'"
        class="pointer-events-none absolute inset-x-0 bottom-0 h-[8px] bg-black/60"
      >
        <div class="h-full bg-[var(--sw-success)] transition-[width] duration-300 ease-out" :style="{ width: `${percent ?? 0}%` }" />
      </div>

      <button
        type="button"
        class="sw-play-main"
        :disabled="state === 'launching' || state === 'installing' || stopping"
        @click="onPrimary"
      >
        <Transition name="sw-swap" mode="out-in">
          <span :key="state + (forceNext ? '-force' : '')" class="flex min-w-0 flex-1 items-center gap-4">
            <span class="sw-play-icon">
              <UIcon v-if="state === 'launching' || (state === 'running' && stopping)" name="i-pixelarticons-loader" class="size-6 animate-[spin_1s_steps(8,end)_infinite]" />
              <UIcon v-else-if="state === 'installing'" name="i-pixelarticons-download" class="size-6" />
              <UIcon v-else-if="state === 'running'" name="i-pixelarticons-close" class="size-6" />
              <UIcon v-else-if="state === 'error'" name="i-pixelarticons-reload" class="size-6" />
              <UIcon v-else name="i-pixelarticons-play" class="size-7" />
            </span>

            <span class="min-w-0 flex-1 text-left">
              <span class="flex items-baseline justify-between gap-3">
                <span
                  class="truncate font-display font-bold leading-tight"
                  :class="state === 'installing' ? 'text-[18px]' : 'text-[30px] uppercase tracking-[0.06em] [text-shadow:2px_3px_0_rgb(0_0_0/0.35)]'"
                >{{ title }}</span>
                <span v-if="state === 'installing' && percent !== null" class="font-mono text-[15px] font-semibold tabular-nums">{{ percent }}%</span>
              </span>
              <span class="mt-0.5 block truncate text-[13px] font-medium opacity-80">{{ subtitle }}</span>
            </span>
          </span>
        </Transition>
      </button>

      <span class="sw-play-divider" />

      <button
        v-if="state === 'running'"
        type="button"
        class="sw-play-side"
        :title="$t('activity.openLogs')"
        :aria-label="$t('activity.openLogs')"
        @click="instance && activity.openLiveLogs(instance.id)"
      >
        <UIcon name="i-pixelarticons-terminal" class="size-6" />
      </button>
      <UPopover v-else v-model:open="switcherOpen" :content="{ side: 'top', align: 'center', sideOffset: 12 }">
        <button type="button" class="sw-play-side" :aria-label="$t('home.switchInstance')" :disabled="state === 'launching' || state === 'installing'">
          <UIcon name="i-pixelarticons-chevron-up" class="sw-play-chevron size-6" :class="{ 'is-open': switcherOpen }" />
        </button>
        <template #content>
          <HomeInstanceSwitcher @done="switcherOpen = false" />
        </template>
      </UPopover>
    </div>

    <Transition name="sw-rise">
      <p v-if="notice" class="sw-block flex max-w-full items-center gap-2 px-3 py-1.5 text-[13px]" :class="notice.class">
        <UIcon :name="notice.icon" class="size-4 shrink-0" />
        <span class="truncate" :title="notice.text">{{ notice.text }}</span>
        <NuxtLink v-if="notice.link" :to="notice.link" class="shrink-0 font-semibold text-white underline-offset-4 hover:underline">
          {{ $t('home.welcome.addAccount') }}
        </NuxtLink>
      </p>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import type { Instance } from '~/types/launcher'

const props = defineProps<{ instance?: Instance }>()

const accounts = useAccountStore()
const activity = useActivityCenter()
const launchFlow = useLaunchFlow()
const toast = useToast()
const { t } = useI18n()
const quickStart = useQuickStart()

const mc = useMinecraftLaunch(() => props.instance?.id)
const switcherOpen = ref(false)

type State = 'none' | 'ready' | 'launching' | 'installing' | 'running' | 'error'

const state = computed<State>(() => {
  if (!props.instance) return quickStart.busy.value ? 'launching' : 'none'
  const stage = mc.stage.value
  if (stage === 'running') return 'running'
  if (stage === 'installing') return 'installing'
  if (stage === 'launching') return 'launching'
  if (mc.error.value) return 'error'
  return 'ready'
})

const percent = computed(() => {
  const { current, total } = mc.progress.value
  return total > 0 ? Math.min(100, Math.floor((current / total) * 100)) : null
})

const STEP_KEYS: Record<string, string> = { Asset: 'assets', Library: 'libraries', Java: 'java' }

const title = computed(() => {
  switch (state.value) {
    case 'none': return t('home.quickStart.title')
    case 'launching': return t('play.launching')
    case 'installing': return t(`play.step.${STEP_KEYS[mc.progress.value.step ?? ''] ?? 'files'}`)
    case 'running': return forceNext.value ? t('play.forceStop') : stopping.value ? t('play.stopping') : t('play.stop')
    case 'error': return t('play.retry')
    default: return t('instance.play')
  }
})

const subtitle = computed(() => {
  const i = props.instance
  if (!i) return quickStart.busy.value ? t('home.quickStart.creating') : t('home.quickStart.hint')
  const label = `${i.name} · ${loaderLabel(i.loader.type)} ${i.mc_version}`
  if (state.value === 'installing') {
    const { current, total } = mc.progress.value
    return total ? t('play.installingFiles', { version: i.mc_version, current, total }) : t('play.installing', { version: i.mc_version })
  }
  if (state.value === 'running') return forceNext.value ? t('play.forceStopHint') : label
  return label
})

const notice = computed(() => {
  if (state.value === 'error') return { text: mc.error.value!, icon: 'i-pixelarticons-alert', class: 'text-[#ff8a8e]' }
  if (props.instance && accounts.loaded && !accounts.activeAccount && state.value === 'ready') {
    return { text: t('home.status.noAccount'), icon: 'i-pixelarticons-user-x', class: 'text-[#ffc56b]', link: { path: '/settings', query: { section: 'accounts' } } }
  }
  return null
})

// Stopping: ask the game to quit; if it is still up a few seconds later, the
// next click force-kills it (the same two options as the instance page).
const stopping = ref(false)
const forceNext = ref(false)
let forceTimer: ReturnType<typeof setTimeout> | null = null

watch(state, (s) => {
  if (s !== 'running') {
    stopping.value = false
    forceNext.value = false
    if (forceTimer) clearTimeout(forceTimer)
  }
})

async function stop(force: boolean) {
  const id = props.instance!.id
  stopping.value = true
  try {
    await invoke('stop_instance', { id, force })
    if (!(await invoke<boolean>('is_instance_running', { id }).catch(() => true))) {
      activity.clear(id)
      return
    }
    forceTimer = setTimeout(() => {
      if (state.value === 'running') forceNext.value = true
      stopping.value = false
    }, 5000)
  } catch (e) {
    stopping.value = false
    toast.add({ title: errorText(e), color: 'error' })
  }
}

function onPrimary() {
  const i = props.instance
  if (!i) {
    return quickStart.start().catch(e => toast.add({ title: t('home.quickStart.failed'), description: errorText(e), color: 'error' }))
  }
  if (state.value === 'running') return stop(forceNext.value)
  if (state.value === 'ready' || state.value === 'error') launchFlow.play(i.id)
}

onBeforeUnmount(() => {
  if (forceTimer) clearTimeout(forceTimer)
})
</script>

<style scoped>
.sw-play {
  --play-hover: rgb(255 255 255 / 0.12);
  --play-divider: rgb(0 0 0 / 0.35);
  display: flex;
  width: 100%;
  height: 84px;
  overflow: hidden;
}
.sw-play :focus-visible {
  outline: none;
}
.sw-play:has(:focus-visible) {
  filter: brightness(1.15);
}
.sw-play[data-state='launching'] {
  --chunk-bg: color-mix(in srgb, var(--sw-accent) 55%, #555);
}
.sw-play[data-state='installing'] {
  --chunk-bg: var(--sw-surface-3);
  --chunk-fg: #ffffff;
  --chunk-side: var(--sw-line-strong);
  --play-hover: transparent;
}
.sw-play[data-state='running'] {
  --chunk-bg: #e5484d;
  --chunk-fg: #ffffff;
  --chunk-side: #6e1d20;
  --play-hover: rgb(255 255 255 / 0.14);
}

.sw-play-main {
  position: relative;
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  padding: 0 20px 0 14px;
  transition: background-color 150ms var(--ease-swift);
}
.sw-play-main:not(:disabled):hover,
.sw-play-side:not(:disabled):hover {
  background: var(--play-hover);
}
.sw-play-main:disabled,
.sw-play-side:disabled {
  cursor: default;
}
.sw-play-icon {
  display: flex;
  width: 46px;
  height: 46px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
  background: rgb(0 0 0 / 0.22);
  box-shadow: inset 0 3px 0 rgb(0 0 0 / 0.18);
}
.sw-play-divider {
  position: relative;
  width: 3px;
  margin: 0;
  background: var(--play-divider);
}
.sw-play-side {
  position: relative;
  display: flex;
  width: 64px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  transition: background-color 150ms var(--ease-swift);
}
.sw-play[data-open='true'] .sw-play-side {
  background: rgb(255 255 255 / 0.12);
}

/* Version switcher chevron: springs round when the menu opens */
.sw-play-chevron {
  transform: rotate(180deg);
  transition: transform 240ms steps(4);
}
.sw-play-chevron.is-open {
  transform: rotate(0deg) translateY(-1px);
}

.sw-swap-enter-active,
.sw-swap-leave-active {
  transition: opacity 160ms var(--ease-swift), transform 160ms var(--ease-swift);
}
.sw-swap-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.sw-swap-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
