<template>
  <div v-if="instance" class="h-full overflow-y-auto">
    <div class="px-8 pb-8 pt-6">
      <NuxtLink to="/instances" class="mb-5 inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-highlighted">
        <UIcon name="i-lucide-arrow-left" class="size-3.5" /> {{ $t('instance.back') }}
      </NuxtLink>

      <header class="flex flex-wrap items-center gap-5">
        <InstanceIcon :key="iconKey" :instance="instance" class="size-16 rounded-xl text-2xl shadow-[0_6px_20px_rgba(0,0,0,0.4)]" />

        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2.5">
            <h1 class="truncate font-display text-[26px] font-semibold leading-tight text-highlighted">{{ instance.name }}</h1>
            <UTooltip :text="isSelected ? $t('library.selected') : $t('library.select')">
              <UButton
                icon="i-lucide-star"
                size="xs"
                :color="isSelected ? 'primary' : 'neutral'"
                variant="ghost"
                square
                :aria-label="$t('library.select')"
                @click="instances.select(id)"
              />
            </UTooltip>
          </div>
          <div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
            <span class="font-mono">Minecraft {{ instance.mc_version }}</span>
            <span class="text-dimmed">·</span>
            <span>
              {{ loaderLabel(instance.loader.type) }}
              <span v-if="loaderVersion" class="font-mono text-dimmed">{{ loaderVersion }}</span>
            </span>
            <span class="text-dimmed">·</span>
            <span class="inline-flex items-center gap-1"><UIcon name="i-lucide-clock" class="size-3.5 text-dimmed" />{{ lastPlayed ?? $t('instance.neverPlayed') }}</span>
            <span class="text-dimmed">·</span>
            <span class="inline-flex items-center gap-1" :title="$t('instance.playtime')">
              <UIcon name="i-lucide-hourglass" class="size-3.5 text-dimmed" />{{ formatPlaytime(instance.playtime_seconds, locale) }}
            </span>
            <UBadge v-if="instance.group" color="neutral" variant="subtle" size="sm" :label="instance.group" />
          </div>
        </div>

        <div class="flex items-center gap-2">
          <UTooltip :text="$t('instance.openGameFolder')">
            <UButton icon="i-lucide-folder-open" color="neutral" variant="soft" square :aria-label="$t('instance.openGameFolder')" @click="openGameFolder" />
          </UTooltip>
          <UTooltip :text="$t('instance.tabs.settings')">
            <UButton icon="i-lucide-settings-2" color="neutral" variant="soft" square :aria-label="$t('instance.tabs.settings')" @click="settingsOpen = true" />
          </UTooltip>
          <UDropdownMenu :items="menuItems" :content="{ align: 'end' }">
            <UButton icon="i-lucide-ellipsis" color="neutral" variant="soft" square :aria-label="$t('instance.more')" />
          </UDropdownMenu>

          <template v-if="mc.stage.value === 'running'">
            <UButton icon="i-lucide-square" color="neutral" variant="soft" :loading="stopping" :label="$t('instance.close')" :title="$t('instance.closeHint')" @click="stopInstance(false)" />
            <UButton icon="i-lucide-skull" color="error" variant="soft" :loading="killing" :label="$t('instance.kill')" :title="$t('instance.killHint')" @click="stopInstance(true)" />
          </template>

          <UButton
            size="lg"
            class="min-w-[140px] justify-center font-display font-bold uppercase tracking-[0.1em]"
            :icon="isBusy ? 'i-lucide-loader-circle' : 'i-lucide-play'"
            :ui="{ leadingIcon: isBusy && mc.stage.value !== 'running' ? 'animate-spin' : '' }"
            :disabled="isBusy"
            :label="playLabel"
            @click="launchFlow.play(id)"
          />
        </div>
      </header>

      <div v-if="mc.stage.value === 'installing'" class="mt-5">
        <div class="mb-1.5 flex items-center justify-between text-xs text-muted">
          <span>{{ $t('home.status.installing') }}</span>
          <span v-if="mc.progress.value.total" class="font-mono tabular-nums">{{ mc.progress.value.current }} / {{ mc.progress.value.total }}</span>
        </div>
        <UProgress size="xs" :model-value="mc.progress.value.current" :max="mc.progress.value.total || 100" />
      </div>

      <p v-if="mc.error.value" class="mt-4 flex items-start gap-2 rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">
        <UIcon name="i-lucide-circle-alert" class="mt-0.5 size-4 shrink-0" />
        {{ mc.error.value }}
      </p>

      <div v-if="modpackUpdate" class="mt-5 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
        <div class="flex flex-wrap items-center gap-2">
          <UIcon name="i-lucide-circle-arrow-up" class="size-4 text-primary" />
          <span class="text-sm font-medium text-highlighted">{{ $t('instance.updateAvailable', { v: modpackUpdate.version_number }) }}</span>
          <UBadge v-if="modpackUpdate.version_type === 'beta'" color="warning" variant="subtle" size="xs" label="BETA" />
          <div class="ml-auto flex items-center gap-2">
            <UButton
              v-if="modpackUpdate.changelog"
              color="neutral"
              variant="ghost"
              size="xs"
              :icon="showChangelog ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
              :label="$t('instance.showChangelog')"
              @click="toggleChangelog"
            />
            <UButton size="xs" :loading="updatingModpack" :label="$t('instance.updateNow')" @click="updateModpack" />
          </div>
        </div>
        <div v-if="showChangelog && changelogHtml" class="mk-md mt-3 max-h-64 overflow-y-auto border-t border-primary/20 pt-3 text-sm" v-html="changelogHtml" />
      </div>

      <nav class="mt-7 flex gap-1 border-b border-default">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          class="relative -mb-px flex items-center gap-2 border-b-2 px-3 pb-2.5 pt-1 text-[13px] font-medium transition-colors"
          :class="activeTab === tab.key
            ? 'border-primary text-highlighted'
            : 'border-transparent text-muted hover:text-toned'"
          @click="activeTab = tab.key"
        >
          <UIcon :name="tab.icon" class="size-4" />
          {{ $t(tab.label) }}
        </button>
      </nav>

      <div class="pt-6">
        <InstanceLogs v-if="activeTab === 'logs'" :instance-id="id" :initial-rel="initialCrashRel" />
        <InstanceContent v-else-if="activeTab === 'content'" :instance-id="id" :initial-kind="initialKind" />
        <InstanceGameFiles v-else-if="isGameFileTab" :instance-id="id" :tab="activeTab as GameFileTab" @quick-play="(qp: QuickPlay) => launchFlow.play(id, qp)" />
        <InstanceSnapshots v-else-if="activeTab === 'snapshots'" :instance-id="id" :instance-name="instance.name" />
      </div>
    </div>

    <UModal
      v-model:open="settingsOpen"
      :title="$t('instance.tabs.settings')"
      :ui="{ content: 'max-w-3xl h-[min(38rem,85vh)]', body: 'flex-1 min-h-0 overflow-hidden p-0 sm:p-0' }"
    >
      <template #body>
        <InstanceSettings :instance-id="id" @icon-changed="iconKey++" />
      </template>
    </UModal>

    <ChangeLoaderModal />
  </div>

  <UiEmptyState
    v-else-if="instances.loaded"
    icon="i-lucide-search-x"
    :title="$t('instance.notFound')"
  >
    <UButton color="neutral" variant="soft" icon="i-lucide-arrow-left" :label="$t('instance.back')" to="/instances" />
  </UiEmptyState>
</template>

<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import type { ModpackUpdate } from '~/types/modrinth'
import type { QuickPlay } from '~/types/launcher'

const route = useRoute()
const router = useRouter()
const instances = useInstancesStore()
const toast = useToast()
const { t, locale } = useI18n()
const exportModal = useExportModal()
const changeLoaderModal = useChangeLoaderModal()
const confirmRemove = useConfirmRemoveInstance()
const launchFlow = useLaunchFlow()

const id = computed(() => String(route.params.id))
const mc = useMinecraftLaunch(id)
const modrinth = useModrinth()
const activity = useActivityCenter()

onMounted(async () => {
  await instances.ensureLoaded()
  mc.attach()
  checkModpackUpdate()
  try {
    if (await invoke<boolean>('is_instance_running', { id: id.value })) {
      activity.markRunning(id.value)
    }
  } catch { /* not running */ }
})

const instance = computed(() => instances.instances.find(i => i.id === id.value))
const isSelected = computed(() => instances.selectedId === id.value)

const modpackUpdate = ref<ModpackUpdate | null>(null)
const showChangelog = ref(false)
const updatingModpack = ref(false)
const changelogHtml = ref('')

async function checkModpackUpdate() {
  modpackUpdate.value = null
  showChangelog.value = false
  if (!instance.value?.modpack_project_id) return
  try {
    modpackUpdate.value = await modrinth.checkModpackUpdate(id.value)
  } catch { /* offline: no update banner */ }
}

async function toggleChangelog() {
  showChangelog.value = !showChangelog.value
  if (showChangelog.value && !changelogHtml.value && modpackUpdate.value?.changelog) {
    const { marked } = await import('marked')
    const raw = marked.parse(modpackUpdate.value.changelog, { async: false }) as string
    changelogHtml.value = (await import('dompurify')).default.sanitize(raw)
  }
}

async function updateModpack() {
  updatingModpack.value = true
  const tid = activity.startTask(t('activity.updatingModpack'))
  try {
    await modrinth.updateModpack(id.value)
    await instances.load()
    toast.add({ title: t('instance.updated'), color: 'success' })
    modpackUpdate.value = null
    showChangelog.value = false
    changelogHtml.value = ''
  } catch (e) {
    toast.add({ title: errorText(e), color: 'error' })
  } finally {
    activity.endTask(tid)
    updatingModpack.value = false
  }
}

const loaderVersion = computed(() =>
  instance.value && 'version' in instance.value.loader ? instance.value.loader.version : '',
)
const lastPlayed = computed(() => formatRelative(instance.value?.last_played, locale.value))

const isBusy = computed(() => mc.launching.value || mc.stage.value !== 'idle')
const playLabel = computed(() => {
  if (mc.stage.value === 'installing') return t('home.preparing')
  if (mc.stage.value === 'running') return t('instance.running')
  if (mc.launching.value) return t('home.starting')
  return t('instance.play')
})

const stopping = ref(false)
const killing = ref(false)

async function stopInstance(force: boolean) {
  if (force) killing.value = true
  else stopping.value = true
  try {
    await invoke('stop_instance', { id: id.value, force })
    if (!(await invoke<boolean>('is_instance_running', { id: id.value }).catch(() => true))) {
      activity.clear(id.value)
    }
  } catch (e) {
    toast.add({ title: errorText(e), color: 'error' })
  } finally {
    stopping.value = false
    killing.value = false
  }
}

type TabKey = 'content' | 'worlds' | 'screenshots' | 'servers' | 'logs' | 'snapshots'
const tabs: { key: TabKey, label: string, icon: string }[] = [
  { key: 'content', label: 'instance.tabs.content', icon: 'i-lucide-blocks' },
  { key: 'worlds', label: 'instance.tabs.worlds', icon: 'i-lucide-globe' },
  { key: 'screenshots', label: 'instance.tabs.screenshots', icon: 'i-lucide-image' },
  { key: 'servers', label: 'instance.tabs.servers', icon: 'i-lucide-server' },
  { key: 'logs', label: 'instance.tabs.logs', icon: 'i-lucide-scroll-text' },
  { key: 'snapshots', label: 'instance.tabs.snapshots', icon: 'i-lucide-history' },
]
const activeTab = ref<TabKey>('content')
const settingsOpen = ref(false)

type ContentTabKind = 'mod' | 'resourcepack' | 'shader' | 'datapack'
const MERGED_TABS: Record<string, ContentTabKind> = {
  mods: 'mod',
  resourcepacks: 'resourcepack',
  shaders: 'shader',
  datapacks: 'datapack',
}

const initialCrashRel = ref<string | null>(null)
const initialKind = ref<ContentTabKind | undefined>()
onMounted(() => {
  const tabParam = route.query.tab as string | undefined
  if (tabParam && tabs.some(tab => tab.key === tabParam)) {
    activeTab.value = tabParam as TabKey
  } else if (tabParam && MERGED_TABS[tabParam]) {
    activeTab.value = 'content'
    initialKind.value = MERGED_TABS[tabParam]
  }
  const crashRelParam = route.query.crashRel as string | undefined
  if (crashRelParam) {
    initialCrashRel.value = decodeURIComponent(crashRelParam)
    router.replace({ query: {} })
  }
})

type GameFileTab = 'screenshots' | 'worlds' | 'servers'
const GAME_FILE_TABS: GameFileTab[] = ['screenshots', 'worlds', 'servers']
const isGameFileTab = computed(() => (GAME_FILE_TABS as string[]).includes(activeTab.value))

const menuItems = computed(() => [[
  { label: t('instance.export'), icon: 'i-lucide-package', onSelect: () => { if (instance.value) exportModal.open(id.value, instance.value.name) } },
  { label: t('changeLoader.menu'), icon: 'i-lucide-layers', onSelect: () => changeLoaderModal.open(id.value) },
  { label: t('instance.createShortcut'), icon: 'i-lucide-app-window', onSelect: createShortcut },
], [
  { label: t('common.remove'), icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => { if (instance.value) confirmRemove.request(instance.value) } },
]])

async function createShortcut() {
  try {
    await invoke<string>('create_desktop_shortcut', { id: id.value })
    toast.add({ title: t('instance.shortcutCreated'), color: 'success' })
  } catch (e) {
    toast.add({ title: errorText(e), color: 'error' })
  }
}

async function openGameFolder() {
  try {
    await invoke('open_instance_game_folder', { id: id.value })
  } catch (e) {
    toast.add({ title: errorText(e), color: 'error' })
  }
}

const iconKey = ref(0)
</script>
