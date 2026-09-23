<template>
  <div class="flex flex-wrap items-center gap-3">
    <div
      class="sw-play relative flex h-[68px] w-[400px] max-w-full overflow-hidden rounded-[14px]"
      :class="state === 'running' ? 'sw-play--running' : state === 'busy' ? 'sw-play--busy' : ''"
    >
      <div
        v-if="state === 'busy' && percent !== null"
        class="pointer-events-none absolute inset-y-0 left-0 bg-white/12 transition-[width] duration-300"
        :style="{ width: `${percent}%` }"
      />

      <button
        type="button"
        class="relative flex min-w-0 flex-1 items-center gap-4 pl-6 pr-4 text-left"
        :disabled="!instance ? false : state === 'busy'"
        @click="onPrimary"
      >
        <UIcon v-if="state === 'busy'" name="i-lucide-loader-circle" class="size-6 shrink-0 animate-spin" />
        <UIcon v-else-if="state === 'running'" name="i-lucide-square-terminal" class="size-6 shrink-0" />
        <UIcon v-else-if="!instance" name="i-lucide-plus" class="size-6 shrink-0" />
        <svg v-else class="size-6 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.2v15.6L19.8 12z" /></svg>
        <span class="min-w-0">
          <span class="block font-display text-[19px] font-bold uppercase leading-tight tracking-[0.14em]">{{ primaryLabel }}</span>
          <span class="block truncate text-xs font-medium opacity-75">{{ subLabel }}</span>
        </span>
      </button>

      <template v-if="instances.instances.length">
        <div class="relative my-3 w-px bg-current opacity-20" />
        <UPopover v-model:open="switcherOpen" :content="{ side: 'top', align: 'end', sideOffset: 10 }">
          <button type="button" class="relative flex w-16 shrink-0 items-center justify-center" :aria-label="$t('home.switchInstance')">
            <UIcon name="i-lucide-chevron-up" class="size-5 transition-transform duration-200" :class="switcherOpen ? '' : 'rotate-180'" />
          </button>
          <template #content>
            <HomeInstanceSwitcher @done="switcherOpen = false" />
          </template>
        </UPopover>
      </template>
    </div>

    <UButton
      v-if="state === 'running' && instance"
      size="xl"
      color="neutral"
      variant="soft"
      icon="i-lucide-square"
      :loading="stopping"
      :label="$t('instance.stop')"
      class="h-[52px] bg-white/8 text-white hover:bg-white/14"
      @click="stop"
    />
    <UButton
      v-else-if="!instance"
      size="xl"
      color="neutral"
      variant="soft"
      icon="i-lucide-package"
      :label="$t('home.actions.modpacks')"
      class="h-[52px] bg-white/8 text-white hover:bg-white/14"
      @click="browser.open({ kind: 'modpack', mode: 'createModpack' })"
    />

    <p v-if="notice" class="flex w-full items-center gap-2 text-[13px]" :class="notice.class">
      <UIcon :name="notice.icon" class="size-4 shrink-0" />
      <span class="truncate" :title="notice.text">{{ notice.text }}</span>
      <NuxtLink v-if="notice.link" :to="notice.link" class="shrink-0 font-semibold text-white underline-offset-4 hover:underline">{{ $t('home.welcome.addAccount') }}</NuxtLink>
    </p>
  </div>
</template>

<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import type { Instance } from '~/types/launcher'

const props = defineProps<{ instance?: Instance }>()

const instances = useInstancesStore()
const accounts = useAccountStore()
const activity = useActivityCenter()
const launchFlow = useLaunchFlow()
const browser = useContentWindow()
const toast = useToast()
const { t } = useI18n()
const { open: openCreate } = useCreateInstanceModal()

const mc = useMinecraftLaunch(() => props.instance?.id)
const switcherOpen = ref(false)

const percent = computed(() => {
  const { current, total } = mc.progress.value
  return total > 0 ? Math.min(100, Math.round((current / total) * 100)) : null
})

const state = computed<'idle' | 'busy' | 'running'>(() => {
  if (!props.instance) return 'idle'
  if (mc.stage.value === 'running') return 'running'
  if (mc.stage.value === 'installing' || mc.launching.value) return 'busy'
  return 'idle'
})

const primaryLabel = computed(() => {
  if (!props.instance) return t('home.welcome.create')
  if (state.value === 'running') return t('instance.running')
  if (mc.stage.value === 'installing') return percent.value !== null ? `${t('home.preparing')} ${percent.value}%` : t('home.preparing')
  if (state.value === 'busy') return t('home.starting')
  return t('instance.play')
})

const subLabel = computed(() => {
  const i = props.instance
  if (!i) return t('home.welcome.createHint')
  if (state.value === 'running') return t('home.openLogs')
  return `${loaderLabel(i.loader.type)} ${i.mc_version} · ${i.name}`
})

const notice = computed(() => {
  if (mc.error.value) return { text: mc.error.value, icon: 'i-lucide-circle-alert', class: 'text-[var(--sw-danger)]' }
  if (props.instance && accounts.loaded && !accounts.activeAccount) {
    return { text: t('home.status.noAccount'), icon: 'i-lucide-user-x', class: 'text-[var(--sw-warning)]', link: { path: '/settings', query: { section: 'accounts' } } }
  }
  return null
})

function onPrimary() {
  if (!props.instance) return openCreate()
  if (state.value === 'running') return activity.openLiveLogs(props.instance.id)
  if (state.value === 'idle') launchFlow.play(props.instance.id)
}

const stopping = ref(false)
async function stop() {
  if (!props.instance) return
  stopping.value = true
  try {
    await invoke('stop_instance', { id: props.instance.id, force: false })
    if (!(await invoke<boolean>('is_instance_running', { id: props.instance.id }).catch(() => true))) {
      activity.clear(props.instance.id)
    }
  } catch (e) {
    toast.add({ title: errorText(e), color: 'error' })
  } finally {
    stopping.value = false
  }
}
</script>

<style scoped>
.sw-play {
  background: var(--sw-accent);
  color: #fff;
  box-shadow: 0 18px 40px -18px rgb(46 124 255 / 0.9), inset 0 1px 0 rgb(255 255 255 / 0.18);
  transition: background-color 150ms var(--ease-swift), box-shadow 150ms var(--ease-swift), transform 150ms var(--ease-swift);
}
.sw-play:hover {
  background: var(--sw-accent-hover);
  box-shadow: 0 22px 46px -16px rgb(46 124 255 / 1), inset 0 1px 0 rgb(255 255 255 / 0.22);
}
.sw-play:active {
  transform: translateY(1px) scale(0.995);
}
.sw-play--busy,
.sw-play--busy:hover {
  background: var(--color-swift-700);
  box-shadow: none;
}
.sw-play--running,
.sw-play--running:hover {
  background: rgb(255 255 255 / 0.1);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.12);
}
.sw-play button:disabled {
  cursor: default;
}
</style>
