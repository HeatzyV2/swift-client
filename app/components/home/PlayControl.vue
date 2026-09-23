<template>
  <div class="flex w-[min(520px,100%)] flex-col items-center gap-3">
    <div class="sw-play" :data-state="state">
      <!-- Real download progress: fills the whole control -->
      <div
        v-if="state === 'installing'"
        class="pointer-events-none absolute inset-y-0 left-0 bg-primary/25 transition-[width] duration-300 ease-out"
        :style="{ width: `${percent ?? 0}%` }"
      />
      <div
        v-if="state === 'installing'"
        class="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-white/8"
      >
        <div class="h-full bg-primary transition-[width] duration-300 ease-out" :style="{ width: `${percent ?? 0}%` }" />
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
              <UIcon v-if="state === 'launching' || (state === 'running' && stopping)" name="i-lucide-loader-circle" class="size-5 animate-spin" />
              <UIcon v-else-if="state === 'installing'" name="i-lucide-download" class="size-5" />
              <UIcon v-else-if="state === 'running'" name="i-lucide-square" class="size-[18px] fill-current" />
              <UIcon v-else-if="state === 'error'" name="i-lucide-rotate-cw" class="size-5" />
              <UIcon v-else-if="state === 'none'" name="i-lucide-plus" class="size-5" />
              <svg v-else class="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.2v15.6L19.8 12z" /></svg>
            </span>

            <span class="min-w-0 flex-1 text-left">
              <span class="flex items-baseline justify-between gap-3">
                <span
                  class="truncate font-display font-bold leading-tight"
                  :class="state === 'installing' ? 'text-[16px] tracking-[0.01em]' : 'text-[20px] uppercase tracking-[0.12em]'"
                >{{ title }}</span>
                <span v-if="state === 'installing' && percent !== null" class="font-mono text-[15px] font-semibold tabular-nums">{{ percent }}%</span>
              </span>
              <span class="mt-0.5 block truncate text-[12.5px] font-medium opacity-70">{{ subtitle }}</span>
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
        <UIcon name="i-lucide-square-terminal" class="size-5" />
      </button>
      <UPopover v-else v-model:open="switcherOpen" :content="{ side: 'top', align: 'center', sideOffset: 12 }">
        <button type="button" class="sw-play-side" :aria-label="$t('home.switchInstance')" :disabled="state === 'launching' || state === 'installing'">
          <UIcon name="i-lucide-chevron-up" class="size-5 transition-transform duration-200" :class="switcherOpen ? '' : 'rotate-180'" />
        </button>
        <template #content>
          <HomeInstanceSwitcher @done="switcherOpen = false" />
        </template>
      </UPopover>
    </div>

    <Transition name="sw-rise">
      <p v-if="notice" class="flex max-w-full items-center gap-2 rounded-lg bg-black/55 px-3 py-1.5 text-[13px]" :class="notice.class">
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
const { open: openCreate } = useCreateInstanceModal()

const mc = useMinecraftLaunch(() => props.instance?.id)
const switcherOpen = ref(false)

type State = 'none' | 'ready' | 'launching' | 'installing' | 'running' | 'error'

const state = computed<State>(() => {
  if (!props.instance) return 'none'
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
    case 'none': return t('home.welcome.create')
    case 'launching': return t('play.launching')
    case 'installing': return t(`play.step.${STEP_KEYS[mc.progress.value.step ?? ''] ?? 'files'}`)
    case 'running': return forceNext.value ? t('play.forceStop') : stopping.value ? t('play.stopping') : t('play.stop')
    case 'error': return t('play.retry')
    default: return t('instance.play')
  }
})

const subtitle = computed(() => {
  const i = props.instance
  if (!i) return t('home.welcome.createHint')
  const label = `${i.name} · ${loaderLabel(i.loader.type)} ${i.mc_version}`
  if (state.value === 'installing') {
    const { current, total } = mc.progress.value
    return total ? t('play.installingFiles', { version: i.mc_version, current, total }) : t('play.installing', { version: i.mc_version })
  }
  if (state.value === 'running') return forceNext.value ? t('play.forceStopHint') : label
  return label
})

const notice = computed(() => {
  if (state.value === 'error') return { text: mc.error.value!, icon: 'i-lucide-circle-alert', class: 'text-[#ff8a8e]' }
  if (props.instance && accounts.loaded && !accounts.activeAccount && state.value === 'ready') {
    return { text: t('home.status.noAccount'), icon: 'i-lucide-user-x', class: 'text-[#ffc56b]', link: { path: '/settings', query: { section: 'accounts' } } }
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
  if (!i) return openCreate()
  if (state.value === 'running') return stop(forceNext.value)
  if (state.value === 'ready' || state.value === 'error') launchFlow.play(i.id)
}

onBeforeUnmount(() => {
  if (forceTimer) clearTimeout(forceTimer)
})
</script>

<style scoped>
.sw-play {
  --play-bg: #ffffff;
  --play-fg: #0b0d12;
  --play-hover: #f2f4f8;
  --play-divider: rgb(11 13 18 / 0.1);
  position: relative;
  display: flex;
  width: 100%;
  height: 76px;
  overflow: hidden;
  border-radius: 18px;
  background: var(--play-bg);
  color: var(--play-fg);
  box-shadow:
    0 1px 0 rgb(255 255 255 / 0.5) inset,
    0 20px 48px -18px rgb(0 0 0 / 0.75);
  transition: background-color 220ms var(--ease-swift), color 220ms var(--ease-swift), box-shadow 220ms var(--ease-swift), transform 150ms var(--ease-swift);
}
.sw-play[data-state='ready']:hover,
.sw-play[data-state='none']:hover,
.sw-play[data-state='error']:hover {
  transform: translateY(-2px);
  box-shadow:
    0 1px 0 rgb(255 255 255 / 0.5) inset,
    0 26px 56px -16px rgb(0 0 0 / 0.8);
}
.sw-play[data-state='launching'] {
  --play-bg: rgb(255 255 255 / 0.88);
}
.sw-play[data-state='installing'] {
  --play-bg: rgb(12 15 22 / 0.9);
  --play-fg: #ffffff;
  --play-hover: transparent;
  --play-divider: rgb(255 255 255 / 0.1);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.1), 0 18px 44px -16px rgb(0 0 0 / 0.7);
}
.sw-play[data-state='running'] {
  --play-bg: #e5484d;
  --play-fg: #ffffff;
  --play-hover: #d63c41;
  --play-divider: rgb(255 255 255 / 0.22);
  box-shadow: 0 18px 44px -18px rgb(229 72 77 / 0.75);
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
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 11px;
  background: color-mix(in srgb, currentColor 8%, transparent);
}
.sw-play-divider {
  position: relative;
  width: 1px;
  margin: 16px 0;
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
