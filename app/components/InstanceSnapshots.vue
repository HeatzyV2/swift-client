<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import type { Settings, WorldBackup } from '~/types/launcher'

const props = defineProps<{ instanceId: string, instanceName: string }>()

const { t } = useI18n()
const activity = useActivityCenter()
const toast = useToast()

interface Snapshot {
  file: string
  label: string
  created: number
  size: number
  auto: boolean
  items: number
}

const snapshots = ref<Snapshot[]>([])
const loading = ref(true)
const busy = ref('')
const error = ref('')
const confirming = ref('')

const settings = ref<Settings | null>(null)

const worldBackups = ref<WorldBackup[]>([])
const worldFolders = ref<string[]>([])
const chosenWorld = ref('')
const confirmingWorld = ref('')

async function loadWorldBackups() {
  worldBackups.value = await invoke<WorldBackup[]>('list_world_backups', { id: props.instanceId, world: null })
  const worlds = await invoke<{ folder: string }[]>('list_worlds', { id: props.instanceId })
  worldFolders.value = worlds.map(w => w.folder)
  if (!chosenWorld.value || !worldFolders.value.includes(chosenWorld.value)) chosenWorld.value = worldFolders.value[0] ?? ''
}

async function load() {
  loading.value = true
  try {
    snapshots.value = await invoke<Snapshot[]>('list_snapshots', { id: props.instanceId })
    settings.value = await invoke<Settings>('get_settings')
    await loadWorldBackups()
  } catch (e) {
    error.value = errorText(e)
  } finally {
    loading.value = false
  }
}

async function run(key: string, fn: () => Promise<unknown>) {
  busy.value = key
  error.value = ''
  try {
    await fn()
  } catch (e) {
    error.value = errorText(e)
  } finally {
    busy.value = ''
  }
}

const create = () => run('create', async () => {
  await activity.withTask(t('snapshots.taking', { name: props.instanceName }), () =>
    invoke('create_snapshot', { id: props.instanceId, label: null, auto: false }))
  await load()
})

const restore = (s: Snapshot) => run(`restore-${s.file}`, async () => {
  const res = await activity.withTask(t('snapshots.restoring', { name: props.instanceName }), () =>
    invoke<{ installed: number, removed: number, failed: string[], needs_curseforge: number }>(
      'restore_snapshot', { id: props.instanceId, file: s.file }))
  confirming.value = ''
  toast.add({
    title: t('snapshots.restored', { installed: res.installed, removed: res.removed }),
    color: res.failed.length ? 'warning' : 'success',
    description: res.failed.length ? res.failed.join(', ') : undefined,
  })
  await load()
})

const backUpWorld = () => run('world-create', async () => {
  await invoke('create_world_backup', { id: props.instanceId, world: chosenWorld.value })
  toast.add({ title: t('worldBackups.created'), color: 'success' })
  await loadWorldBackups()
})

const restoreWorld = (b: WorldBackup) => run(`world-restore-${b.file}`, async () => {
  const world = await invoke<string>('restore_world_backup', { id: props.instanceId, file: b.file })
  confirmingWorld.value = ''
  toast.add({ title: t('worldBackups.restored', { world }), color: 'success' })
  await loadWorldBackups()
})

const removeWorldBackup = (b: WorldBackup) => run(`world-delete-${b.file}`, async () => {
  await invoke('delete_world_backup', { id: props.instanceId, file: b.file })
  await loadWorldBackups()
})

function askRestoreWorld(b: WorldBackup) {
  if (confirmingWorld.value === b.file) return restoreWorld(b)
  confirmingWorld.value = b.file
  setTimeout(() => {
    if (confirmingWorld.value === b.file) confirmingWorld.value = ''
  }, 4000)
}

const remove = (s: Snapshot) => run(`delete-${s.file}`, async () => {
  await invoke('delete_snapshot', { id: props.instanceId, file: s.file })
  await load()
})

function askRestore(s: Snapshot) {
  if (confirming.value === s.file) return restore(s)
  confirming.value = s.file
  setTimeout(() => {
    if (confirming.value === s.file) confirming.value = ''
  }, 4000)
}

async function saveSetting(patch: Partial<Settings>) {
  if (!settings.value) return
  settings.value = { ...settings.value, ...patch }
  await invoke('save_settings', { settings: settings.value }).catch(e => (error.value = errorText(e)))
}

const fmtSize = (n: number) => n < 1024 ** 2
  ? `${(n / 1024).toFixed(0)} KB`
  : `${(n / 1024 / 1024).toFixed(1)} MB`

const fmtWhen = (ms: number) => new Date(ms).toLocaleString()

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-4 py-2">
    <p v-if="error" class="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">
      {{ error }}
    </p>

    <div class="rounded-xl border-2 border-[var(--sw-line-strong)] p-4">
      <div class="flex flex-wrap items-start gap-3">
        <div class="min-w-[220px] flex-1">
          <h3 class="text-sm font-semibold">{{ $t('snapshots.title') }}</h3>
          <p class="mt-1 text-sm text-muted">{{ $t('snapshots.intro') }}</p>
        </div>
        <UButton
          icon="i-pixelarticons-camera"
          :label="$t('snapshots.create')"
          :loading="busy === 'create'"
          @click="create"
        />
      </div>

      <div v-if="settings" class="mt-4 space-y-3 border-t border-default pt-4">
        <USwitch
          :model-value="settings.snapshot_before_updates"
          :label="$t('snapshots.autoLabel')"
          :description="$t('snapshots.autoHint')"
          @update:model-value="saveSetting({ snapshot_before_updates: $event })"
        />
        <div class="flex flex-wrap items-center gap-3">
          <span class="text-sm">{{ $t('snapshots.keepLabel') }}</span>
          <UInputNumber
            :model-value="settings.snapshot_keep"
            :min="1"
            :max="20"
            class="w-24"
            @update:model-value="saveSetting({ snapshot_keep: $event })"
          />
          <span class="text-xs text-muted">{{ $t('snapshots.keepHint') }}</span>
        </div>
      </div>
    </div>

    <div v-if="loading" class="flex items-center gap-2 rounded-xl border-2 border-[var(--sw-line-strong)] px-3 py-4 text-sm text-muted">
      <UIcon name="i-pixelarticons-loader" class="size-4 animate-spin text-primary-400" />
      {{ $t('common.loading') }}
    </div>

    <ul v-else-if="snapshots.length" class="space-y-2">
      <li
        v-for="s in snapshots"
        :key="s.file"
        class="flex flex-wrap items-center gap-3 rounded-xl border-2 border-[var(--sw-line-strong)] px-3 py-2.5"
      >
        <UIcon
          :name="s.auto ? 'i-pixelarticons-clock' : 'i-pixelarticons-camera'"
          class="size-4 shrink-0 text-neutral-500"
        />
        <div class="min-w-[180px] flex-1">
          <p class="text-sm">
            {{ s.label || $t('snapshots.manual') }}
            <span v-if="s.auto" class="ml-1 rounded-full bg-[var(--sw-line-soft)] px-1.5 py-0.5 text-[10px] text-neutral-400">
              {{ $t('snapshots.autoBadge') }}
            </span>
          </p>
          <p class="text-xs text-muted">
            {{ fmtWhen(s.created) }} · {{ $t('snapshots.items', { n: s.items }) }} · {{ fmtSize(s.size) }}
          </p>
        </div>

        <UButton
          size="sm"
          :color="confirming === s.file ? 'error' : 'neutral'"
          :variant="confirming === s.file ? 'solid' : 'soft'"
          :icon="confirming === s.file ? 'i-pixelarticons-warning-diamond' : 'i-pixelarticons-undo'"
          :label="confirming === s.file ? $t('snapshots.confirmRestore') : $t('snapshots.restore')"
          :loading="busy === `restore-${s.file}`"
          @click="askRestore(s)"
        />
        <UButton
          size="sm"
          color="neutral"
          variant="ghost"
          icon="i-pixelarticons-trash"
          :loading="busy === `delete-${s.file}`"
          :title="$t('common.remove')"
          @click="remove(s)"
        />
      </li>
    </ul>

    <div v-else class="rounded-xl border border-dashed border-default px-4 py-8 text-center">
      <UIcon name="i-pixelarticons-clock" class="mx-auto size-7 text-neutral-600" />
      <p class="mt-2 text-sm text-muted">{{ $t('snapshots.empty') }}</p>
    </div>

    <p v-if="confirming" class="text-xs text-amber-300">{{ $t('snapshots.restoreWarning') }}</p>

    <!-- Worlds: zipped before launching when they changed -->
    <div class="rounded-xl border-2 border-[var(--sw-line-strong)] p-4">
      <h3 class="text-sm font-semibold">{{ $t('worldBackups.title') }}</h3>
      <p class="mt-1 text-sm text-muted">{{ $t('worldBackups.intro') }}</p>

      <div v-if="settings" class="mt-4 space-y-3 border-t border-default pt-4">
        <USwitch
          :model-value="settings.auto_world_backup"
          :label="$t('worldBackups.autoLabel')"
          :description="$t('worldBackups.autoHint')"
          @update:model-value="saveSetting({ auto_world_backup: $event })"
        />
        <div class="flex flex-wrap items-center gap-3">
          <span class="text-sm">{{ $t('worldBackups.keepLabel') }}</span>
          <UInputNumber
            :model-value="settings.world_backup_keep"
            :min="1"
            :max="30"
            class="w-24"
            @update:model-value="saveSetting({ world_backup_keep: $event })"
          />
        </div>
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-2 border-t border-default pt-4">
        <USelect
          v-model="chosenWorld"
          :items="worldFolders"
          :placeholder="$t('worldBackups.chooseWorld')"
          :disabled="!worldFolders.length"
          class="min-w-[200px] flex-1"
        />
        <UButton
          icon="i-pixelarticons-archive"
          :label="$t('worldBackups.backNow')"
          :disabled="!chosenWorld"
          :loading="busy === 'world-create'"
          @click="backUpWorld"
        />
      </div>
      <p v-if="!worldFolders.length && !loading" class="mt-2 text-xs text-dimmed">{{ $t('worldBackups.noWorlds') }}</p>
    </div>

    <ul v-if="worldBackups.length" class="space-y-2">
      <li
        v-for="b in worldBackups"
        :key="b.file"
        class="flex flex-wrap items-center gap-3 rounded-xl border-2 border-[var(--sw-line-strong)] px-3 py-2.5"
      >
        <UIcon :name="b.auto ? 'i-pixelarticons-clock' : 'i-pixelarticons-archive'" class="size-4 shrink-0 text-neutral-500" />
        <div class="min-w-[180px] flex-1">
          <p class="text-sm">
            {{ b.world }}
            <span class="ml-1 rounded-full bg-[var(--sw-line-soft)] px-1.5 py-0.5 text-[10px] text-neutral-400">
              {{ b.auto ? $t('worldBackups.autoBadge') : $t('worldBackups.manual') }}
            </span>
          </p>
          <p class="text-xs text-muted">{{ fmtWhen(b.created) }} · {{ fmtSize(b.size) }}</p>
        </div>
        <UButton
          size="sm"
          :color="confirmingWorld === b.file ? 'error' : 'neutral'"
          :variant="confirmingWorld === b.file ? 'solid' : 'soft'"
          :icon="confirmingWorld === b.file ? 'i-pixelarticons-warning-diamond' : 'i-pixelarticons-undo'"
          :label="confirmingWorld === b.file ? $t('snapshots.confirmRestore') : $t('snapshots.restore')"
          :loading="busy === `world-restore-${b.file}`"
          @click="askRestoreWorld(b)"
        />
        <UButton
          size="sm"
          color="neutral"
          variant="ghost"
          icon="i-pixelarticons-trash"
          :loading="busy === `world-delete-${b.file}`"
          :title="$t('common.remove')"
          @click="removeWorldBackup(b)"
        />
      </li>
    </ul>
    <p v-else-if="!loading" class="rounded-xl border border-dashed border-default px-4 py-5 text-center text-sm text-muted">{{ $t('worldBackups.empty') }}</p>
    <p v-if="confirmingWorld" class="text-xs text-amber-300">{{ $t('worldBackups.restoreWarning') }}</p>
  </div>
</template>
