<template>
  <div class="flex w-full flex-col gap-2.5">
    <!-- The dock: selected instance on the left, live state in the middle, Play on the right -->
    <div class="sw-dock sw-glass" :data-state="state">
      <InstanceIcon v-if="instance" :instance="instance" class="size-12 shrink-0 rounded-[12px] text-base" />
      <div v-else class="flex size-12 shrink-0 items-center justify-center rounded-[12px] bg-[var(--sw-surface-3)]">
        <UIcon name="i-lucide-sparkles" class="size-5 text-primary" />
      </div>

      <div class="min-w-0 max-w-[280px]">
        <p class="truncate text-[15px] font-bold text-highlighted">{{ instance?.name ?? $t('home.quickStart.title') }}</p>
        <p class="truncate text-[12.5px] text-muted">{{ subtitle }}</p>
      </div>

      <UPopover v-if="state !== 'running'" v-model:open="switcherOpen" :content="{ side: 'top', align: 'start', sideOffset: 12 }">
        <button type="button" class="sw-dock-icon" :aria-label="$t('home.switchInstance')" :disabled="state === 'launching' || state === 'installing'">
          <UIcon name="i-lucide-chevrons-up-down" class="size-4" />
        </button>
        <template #content>
          <HomeInstanceSwitcher @done="switcherOpen = false" />
        </template>
      </UPopover>
      <button
        v-else
        type="button"
        class="sw-dock-icon"
        :title="$t('activity.openLogs')"
        :aria-label="$t('activity.openLogs')"
        @click="instance && activity.openLiveLogs(instance.id)"
      >
        <UIcon name="i-lucide-terminal" class="size-4" />
      </button>

      <div class="flex-1" />

      <!-- Download progress, with Zip sprinting along it -->
      <div v-if="state === 'installing' || state === 'launching'" class="relative hidden w-[240px] flex-col gap-1.5 md:flex">
        <div class="pointer-events-none absolute -top-[46px] h-[40px] transition-[left] duration-300 ease-linear" :style="{ left: `calc(${state === 'launching' ? 100 : (percent ?? 0)}% - 34px)` }">
          <BrandMascot pose="run" class="h-[40px] w-auto" />
        </div>
        <div class="flex items-baseline justify-between gap-3 text-[12px]">
          <span class="truncate text-toned">{{ title }}</span>
          <span v-if="percent !== null && state === 'installing'" class="font-mono tabular-nums text-muted">{{ percent }}%</span>
        </div>
        <div class="h-1.5 overflow-hidden rounded-full bg-white/8">
          <div
            class="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
            :class="state === 'launching' ? 'w-full animate-pulse' : ''"
            :style="state === 'installing' ? { width: `${percent ?? 0}%` } : undefined"
          />
        </div>
      </div>

      <button
        type="button"
        class="sw-dock-play sw-chunk"
        :data-state="state"
        :disabled="state === 'launching' || state === 'installing' || stopping"
        @click="onPrimary"
      >
        <UIcon v-if="state === 'launching' || state === 'installing' || (state === 'running' && stopping)" name="i-lucide-loader-circle" class="size-5 animate-spin" />
        <UIcon v-else-if="state === 'running'" name="i-lucide-square" class="size-4" />
        <UIcon v-else-if="state === 'error'" name="i-lucide-refresh-cw" class="size-5" />
        <UIcon v-else name="i-lucide-play" class="size-5" />
        <span class="truncate">{{ state === 'installing' || state === 'launching' ? $t('play.launching') : title }}</span>
      </button>
    </div>

    <Transition name="sw-rise">
      <p v-if="notice" class="sw-glass flex max-w-full items-center gap-2 self-start rounded-[10px] px-3 py-1.5 text-[13px]" :class="notice.class">
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
  const label = `${loaderLabel(i.loader.type)} ${i.mc_version}`
  if (state.value === 'installing') {
    const { current, total } = mc.progress.value
    return total ? t('play.installingFiles', { version: i.mc_version, current, total }) : t('play.installing', { version: i.mc_version })
  }
  if (state.value === 'running') return forceNext.value ? t('play.forceStopHint') : label
  return label
})

const notice = computed(() => {
  if (state.value === 'error') return { text: mc.error.value!, icon: 'i-lucide-triangle-alert', class: 'text-[#ff8a8e]' }
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
.sw-dock {
  display: flex;
  min-height: 80px;
  align-items: center;
  gap: 14px;
  padding: 14px 14px 14px 16px;
  border-radius: 18px;
}
.sw-dock-icon {
  display: flex;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  border: 1px solid var(--sw-line-strong);
  color: var(--ui-text-muted);
  transition: color 160ms var(--ease-swift), border-color 160ms var(--ease-swift), background-color 160ms var(--ease-swift);
}
.sw-dock-icon:not(:disabled):hover {
  color: var(--ui-text-highlighted);
  border-color: color-mix(in srgb, var(--sw-accent) 45%, var(--sw-line-strong));
  background: var(--sw-surface-2);
}
.sw-dock-icon:disabled {
  opacity: 0.5;
}
.sw-dock-play {
  display: flex;
  height: 56px;
  min-width: 190px;
  max-width: 280px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 0 34px;
  font-size: 17px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.sw-dock-play:disabled {
  cursor: default;
}
.sw-dock-play[data-state='launching'],
.sw-dock-play[data-state='installing'] {
  --chunk-bg: color-mix(in srgb, var(--sw-accent) 45%, var(--sw-surface-3));
}
.sw-dock-play[data-state='running'] {
  --chunk-bg: #e5484d;
  --chunk-fg: #ffffff;
}
</style>
