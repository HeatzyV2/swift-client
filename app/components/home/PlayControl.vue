<template>
  <div class="flex w-full max-w-[400px] flex-col gap-2.5">
    <div class="relative">
      <!-- Zip sprints along the button while the game downloads -->
      <div
        v-if="state === 'installing' || state === 'launching'"
        class="pointer-events-none absolute -top-[40px] h-[36px] transition-[left] duration-300 ease-linear"
        :style="{ left: `calc(${state === 'launching' ? 100 : (percent ?? 0)}% - 30px)` }"
      >
        <BrandMascot pose="run" class="h-[36px] w-auto" />
      </div>

      <div class="sw-play" :data-state="state">
        <!-- Progress fills the button from the left -->
        <span
          v-if="state === 'installing' || state === 'launching'"
          class="pointer-events-none absolute inset-y-0 left-0 bg-white/14 transition-[width] duration-300 ease-out"
          :class="state === 'launching' ? 'w-full animate-pulse' : ''"
          :style="state === 'installing' ? { width: `${percent ?? 0}%` } : undefined"
        />

        <button
          type="button"
          class="sw-play-main"
          :disabled="state === 'launching' || state === 'installing' || stopping"
          @click="onPrimary"
        >
          <UIcon v-if="state === 'launching' || state === 'installing' || (state === 'running' && stopping)" name="i-lucide-loader-circle" class="size-6 shrink-0 animate-spin" />
          <UIcon v-else-if="state === 'running'" name="i-lucide-square" class="size-5 shrink-0" />
          <UIcon v-else-if="state === 'error'" name="i-lucide-refresh-cw" class="size-6 shrink-0" />
          <UIcon v-else name="i-lucide-play" class="size-7 shrink-0" />
          <span class="min-w-0 text-left">
            <span class="font-headline block truncate text-[21px] font-extrabold! uppercase leading-none tracking-[0.03em]">{{ title }}</span>
            <span class="block truncate text-[12.5px] font-medium leading-tight opacity-85">{{ subtitle }}</span>
          </span>
          <span v-if="percent !== null && state === 'installing'" class="ml-auto pl-2 font-mono text-[12px] tabular-nums opacity-85">{{ percent }}%</span>
        </button>

        <UPopover v-if="state !== 'running'" v-model:open="switcherOpen" :content="{ side: 'bottom', align: 'end', sideOffset: 10 }">
          <button type="button" class="sw-play-more" :aria-label="$t('home.switchInstance')" :disabled="state === 'launching' || state === 'installing'">
            <UIcon name="i-lucide-chevron-down" class="size-5" />
          </button>
          <template #content>
            <HomeInstanceSwitcher @done="switcherOpen = false" />
          </template>
        </UPopover>
        <button
          v-else
          type="button"
          class="sw-play-more"
          :title="$t('activity.openLogs')"
          :aria-label="$t('activity.openLogs')"
          @click="instance && activity.openLiveLogs(instance.id)"
        >
          <UIcon name="i-lucide-terminal" class="size-4" />
        </button>
      </div>
    </div>

    <Transition name="sw-rise">
      <p v-if="notice" class="flex max-w-full items-center gap-2 text-[13px]" :class="notice.class">
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
    default: return `${t('instance.play')} ${props.instance?.mc_version ?? ''}`.trim()
  }
})

const subtitle = computed(() => {
  const i = props.instance
  if (!i) return quickStart.busy.value ? t('home.quickStart.creating') : t('home.quickStart.hint')
  if (state.value === 'installing') {
    const { current, total } = mc.progress.value
    return total ? t('play.installingFiles', { version: i.mc_version, current, total }) : t('play.installing', { version: i.mc_version })
  }
  if (state.value === 'running' && forceNext.value) return t('play.forceStopHint')
  return i.name
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
.sw-play {
  position: relative;
  display: flex;
  height: 58px;
  overflow: hidden;
  border-radius: 10px;
  background: var(--sw-accent);
  color: var(--sw-accent-fg);
  box-shadow: 0 10px 28px -12px color-mix(in srgb, var(--sw-accent) 80%, transparent);
  transition: background-color 160ms var(--ease-swift), box-shadow 160ms var(--ease-swift);
}
.sw-play:hover {
  background: var(--sw-accent-hover);
}
.sw-play[data-state='launching'],
.sw-play[data-state='installing'] {
  background: color-mix(in srgb, var(--sw-accent) 70%, var(--sw-surface-3));
}
.sw-play[data-state='running'] {
  background: #e5484d;
  color: #ffffff;
  box-shadow: 0 10px 28px -12px rgb(229 72 77 / 0.8);
}
.sw-play-main {
  position: relative;
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 16px;
  padding: 0 18px 0 22px;
}
.sw-play-main:disabled {
  cursor: default;
}
.sw-play-more {
  position: relative;
  display: flex;
  width: 44px;
  margin: 7px 7px 7px 0;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  background: rgb(0 0 0 / 0.18);
  transition: background-color 160ms var(--ease-swift);
}
.sw-play-more:not(:disabled):hover {
  background: rgb(0 0 0 / 0.3);
}
.sw-play-more:disabled {
  opacity: 0.5;
}
</style>
