<template>
  <section class="relative overflow-hidden rounded-2xl border border-default bg-[var(--sw-surface)]">
    <BrandMark class="pointer-events-none absolute -right-10 -top-16 size-[360px] text-white opacity-[0.025]" />
    <div class="pointer-events-none absolute -left-32 -top-40 size-[460px] rounded-full bg-[radial-gradient(closest-side,rgb(46_124_255/0.10),transparent)]" />

    <div class="relative flex flex-wrap items-end justify-between gap-8 p-8">
      <div class="min-w-0 flex-1">
        <div class="mb-5 flex items-center gap-3">
          <span class="sw-eyebrow">{{ $t('home.selected') }}</span>
          <USelectMenu
            :model-value="instance.id"
            :items="pickerItems"
            value-key="value"
            size="xs"
            color="neutral"
            variant="soft"
            :search-input="{ placeholder: $t('library.search') }"
            class="w-48"
            @update:model-value="(id: string) => instances.select(id)"
          />
        </div>

        <div class="flex items-center gap-5">
          <InstanceIcon :instance="instance" class="size-[72px] rounded-xl text-3xl shadow-[0_8px_24px_rgba(0,0,0,0.45)]" />
          <div class="min-w-0">
            <h2 class="truncate font-display text-[34px] font-semibold leading-tight text-highlighted">{{ instance.name }}</h2>
            <div class="mt-2 flex flex-wrap items-center gap-2">
              <span class="sw-chip font-mono">Minecraft {{ instance.mc_version }}</span>
              <span class="sw-chip">
                {{ loaderLabel(instance.loader.type) }}
                <span v-if="loaderVersion" class="ml-1 font-mono text-dimmed">{{ loaderVersion }}</span>
              </span>
            </div>
          </div>
        </div>

        <dl class="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-[13px]">
          <div>
            <dt class="text-dimmed">{{ $t('instance.lastPlayed') }}</dt>
            <dd class="mt-0.5 text-toned">{{ lastPlayed ?? $t('instance.neverPlayed') }}</dd>
          </div>
          <div>
            <dt class="text-dimmed">{{ $t('instance.playtime') }}</dt>
            <dd class="mt-0.5 text-toned">{{ formatPlaytime(instance.playtime_seconds) }}</dd>
          </div>
          <div v-if="memoryMb">
            <dt class="text-dimmed">{{ $t('home.memory') }}</dt>
            <dd class="mt-0.5 text-toned">{{ (memoryMb / 1024).toFixed(1) }} GB</dd>
          </div>
        </dl>
      </div>

      <div class="flex w-[260px] shrink-0 flex-col items-stretch gap-3">
        <button
          type="button"
          class="sw-play"
          :disabled="busy"
          @click="launchFlow.play(instance.id)"
        >
          <UIcon v-if="mc.stage.value === 'installing' || mc.launching.value" name="i-lucide-loader-circle" class="size-5 animate-spin" />
          <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z" /></svg>
          <span>{{ playLabel }}</span>
        </button>

        <div v-if="mc.stage.value === 'running'" class="flex gap-2">
          <UButton class="flex-1 justify-center" color="neutral" variant="soft" icon="i-lucide-square-terminal" :label="$t('home.logs')" @click="activity.openLiveLogs(instance.id)" />
          <UButton class="flex-1 justify-center" color="neutral" variant="soft" icon="i-lucide-square" :loading="stopping" :label="$t('instance.stop')" @click="stop" />
        </div>

        <p class="flex items-center justify-center gap-2 text-xs" :class="status.class">
          <span class="size-1.5 shrink-0 rounded-full" :class="status.dot" />
          <span class="truncate" :title="status.text">{{ status.text }}</span>
        </p>
      </div>
    </div>

    <div v-if="mc.stage.value === 'installing'" class="relative h-[3px] w-full bg-white/5">
      <div
        class="absolute inset-y-0 left-0 bg-primary transition-[width] duration-300"
        :style="{ width: `${percent ?? 0}%` }"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import type { Instance, Settings } from '~/types/launcher'

const props = defineProps<{ instance: Instance, settings: Settings | null }>()

const instances = useInstancesStore()
const accounts = useAccountStore()
const activity = useActivityCenter()
const launchFlow = useLaunchFlow()
const toast = useToast()
const { t, locale } = useI18n()

const mc = useMinecraftLaunch(() => props.instance.id)

const pickerItems = computed(() =>
  [...instances.instances]
    .sort((a, b) => (b.last_played ?? '').localeCompare(a.last_played ?? '') || a.name.localeCompare(b.name))
    .map(i => ({ label: i.name, value: i.id })),
)

const loaderVersion = computed(() => ('version' in props.instance.loader ? props.instance.loader.version : ''))
const lastPlayed = computed(() => formatRelative(props.instance.last_played, locale.value))
const memoryMb = computed(() =>
  props.instance.override_memory && props.instance.memory_mb ? props.instance.memory_mb : props.settings?.default_memory_mb ?? null,
)

const percent = computed(() => {
  const { current, total } = mc.progress.value
  return total > 0 ? Math.min(100, Math.round((current / total) * 100)) : null
})

const busy = computed(() => mc.launching.value || mc.stage.value !== 'idle')

const playLabel = computed(() => {
  if (mc.stage.value === 'installing') return percent.value !== null ? `${percent.value}%` : t('home.preparing')
  if (mc.stage.value === 'running') return t('instance.running')
  if (mc.launching.value) return t('home.starting')
  return t('instance.play')
})

const status = computed(() => {
  if (mc.error.value) return { text: mc.error.value, class: 'text-error', dot: 'bg-[var(--sw-danger)]' }
  if (accounts.loaded && !accounts.activeAccount) return { text: t('home.status.noAccount'), class: 'text-warning', dot: 'bg-[var(--sw-warning)]' }
  if (mc.stage.value === 'installing') return { text: t('home.status.installing'), class: 'text-muted', dot: 'bg-primary animate-pulse' }
  if (mc.stage.value === 'running') return { text: t('home.status.running'), class: 'text-muted', dot: 'bg-[var(--sw-success)]' }
  return { text: t('home.status.ready'), class: 'text-dimmed', dot: 'bg-[var(--sw-success)]' }
})

const stopping = ref(false)
async function stop() {
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
.sw-chip {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 9px;
  border-radius: 6px;
  border: 1px solid var(--sw-line);
  background: var(--sw-surface-2);
  font-size: 12px;
  color: var(--ui-text-toned);
}

.sw-play {
  display: flex;
  height: 56px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border-radius: 10px;
  background: var(--sw-accent);
  color: #fff;
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  box-shadow: 0 10px 28px -12px rgb(46 124 255 / 0.75), inset 0 1px 0 rgb(255 255 255 / 0.14);
  transition: background-color 120ms var(--ease-swift), transform 120ms var(--ease-swift), box-shadow 120ms var(--ease-swift);
}
.sw-play:hover:not(:disabled) {
  background: var(--sw-accent-hover);
  box-shadow: 0 12px 32px -10px rgb(46 124 255 / 0.85), inset 0 1px 0 rgb(255 255 255 / 0.18);
}
.sw-play:active:not(:disabled) {
  transform: scale(0.985);
}
.sw-play:disabled {
  cursor: default;
  background: var(--sw-surface-3);
  color: var(--ui-text-toned);
  box-shadow: none;
}
</style>
