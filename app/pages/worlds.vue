<template>
  <div class="h-full overflow-y-auto">
    <div class="sw-page">
      <UiPageHeader icon="i-lucide-globe" :title="$t('worldsPage.title')" :subtitle="$t('worldsPage.count', { worlds: totalWorlds, instances: groups.length })">
        <UButton icon="i-lucide-refresh-cw" color="neutral" variant="soft" :loading="loading" :label="$t('content.refresh')" @click="load" />
      </UiPageHeader>

      <div v-if="loading" class="space-y-8">
        <div v-for="g in 2" :key="`g-sk-${g}`">
          <div class="sw-skeleton mb-4 h-4 w-48" />
          <div class="grid gap-3.5" :style="GRID">
            <div v-for="n in 3" :key="`r-sk-${n}`" class="sw-skeleton h-[132px] rounded-[14px]" />
          </div>
        </div>
      </div>

      <UiEmptyState v-else-if="!groups.length" icon="i-lucide-globe" :title="$t('worldsPage.empty')" />

      <div v-else class="space-y-9">
        <section v-for="group in groups" :key="group.instance.id">
          <div class="sw-section-head">
            <button type="button" class="group/h flex min-w-0 items-center gap-2.5" @click="router.push(`/instance/${group.instance.id}`)">
              <InstanceIcon :instance="group.instance" class="size-7 rounded-[7px] text-[12px]" />
              <span class="sw-eyebrow truncate text-[12px] transition-colors group-hover/h:text-highlighted">{{ group.instance.name }}</span>
              <span class="font-mono text-[11px] text-dimmed">{{ group.instance.mc_version }}</span>
            </button>
            <span class="order-last rounded-full bg-[var(--sw-surface-2)] px-2 py-0.5 text-[11px] text-muted">{{ $t('worldsPage.instanceWorlds', { n: group.worlds.length }) }}</span>
          </div>

          <div class="grid gap-3.5" :style="GRID">
            <div v-for="w in group.worlds" :key="w.folder" class="sw-world group">
              <div class="flex items-center gap-3.5">
                <img
                  v-if="w.icon_path"
                  :src="assetUrl(w.icon_path)"
                  class="size-14 shrink-0 rounded-[12px] object-cover [image-rendering:pixelated] shadow-[0_6px_18px_rgb(0_0_0/0.35)]"
                  :alt="w.name"
                >
                <div v-else class="flex size-14 shrink-0 items-center justify-center rounded-[12px] bg-[var(--sw-surface-3)]">
                  <UIcon name="i-lucide-globe" class="size-6 text-dimmed" />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-[15px] font-bold text-highlighted">{{ w.name }}</p>
                  <p class="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
                    <span v-if="w.version" class="font-mono text-toned">{{ w.version }}</span>
                    <span v-if="w.game_mode">· {{ $t(`content.gameMode.${w.game_mode}`) }}</span>
                  </p>
                </div>
                <button
                  v-if="supportsQuickPlay(group.instance.mc_version)"
                  type="button"
                  class="sw-world-play"
                  :title="$t('quickPlay.playWorld')"
                  :aria-label="$t('quickPlay.playWorld')"
                  @click="playWorld(group.instance.id, w.folder)"
                >
                  <UIcon :name="launching === `${group.instance.id}/${w.folder}` ? 'i-lucide-loader-circle' : 'i-lucide-play'" class="size-[18px]" :class="{ 'animate-spin': launching === `${group.instance.id}/${w.folder}` }" />
                </button>
              </div>

              <div class="mt-3.5 flex items-center gap-2 border-t border-[var(--sw-line)] pt-3 text-[12px] text-dimmed">
                <UIcon name="i-lucide-clock" class="size-3.5" />
                <span class="flex-1 truncate">{{ w.last_played ? formatDate(w.last_played) : '—' }}</span>
                <UTooltip :text="$t('content.backup')">
                  <UButton icon="i-lucide-archive" size="xs" color="neutral" variant="ghost" square :loading="busyWorld === `${group.instance.id}/${w.folder}`" :aria-label="$t('content.backup')" @click="backupWorld(group.instance.id, w)" />
                </UTooltip>
                <UTooltip :text="$t('common.remove')">
                  <UButton icon="i-lucide-trash-2" size="xs" color="error" variant="ghost" square :aria-label="$t('common.remove')" @click="deleteWorld(group.instance.id, w)" />
                </UTooltip>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import { save, confirm } from '@tauri-apps/plugin-dialog'
import type { Instance, WorldInfo } from '~/types/launcher'

const instances = useInstancesStore()
const router = useRouter()
const toast = useToast()
const { t, locale } = useI18n()
const mc = useMinecraftLaunch()

const busyWorld = ref<string | null>(null)

interface WorldGroup { instance: Instance; worlds: WorldInfo[] }
const groups = ref<WorldGroup[]>([])
const loading = ref(true)
const launching = ref<string | null>(null)

const totalWorlds = computed(() => groups.value.reduce((n, g) => n + g.worlds.length, 0))

const GRID = 'grid-template-columns:repeat(auto-fill,minmax(300px,1fr))'
const formatDate = (ms: number) => formatRelative(new Date(ms).toISOString(), locale.value) ?? new Date(ms).toLocaleDateString()

function supportsQuickPlay(ver: string): boolean {
  const [, minorStr = '0'] = ver.split('.')
  return parseInt(minorStr) >= 20
}

async function load() {
  loading.value = true
  try {
    await instances.ensureLoaded()
    const settled = await Promise.all(
      instances.instances.map(async (instance: Instance) => {
        try {
          const worlds = await invoke<WorldInfo[]>('list_worlds', { id: instance.id })
          return { instance, worlds }
        } catch {
          return { instance, worlds: [] as WorldInfo[] }
        }
      }),
    )
    groups.value = settled.filter((g: WorldGroup) => g.worlds.length > 0)
  } finally {
    loading.value = false
  }
}

async function backupWorld(instanceId: string, w: WorldInfo) {
  const dest = await save({ defaultPath: `${w.folder}.zip`, filters: [{ name: 'Zip', extensions: ['zip'] }] })
  if (typeof dest !== 'string') return
  busyWorld.value = `${instanceId}/${w.folder}`
  try {
    await invoke('backup_world', { id: instanceId, folder: w.folder, dest })
    toast.add({ title: t('content.backupDone'), color: 'success' })
  } catch (e) {
    toast.add({ title: errorText(e), color: 'error' })
  } finally {
    busyWorld.value = null
  }
}

async function deleteWorld(instanceId: string, w: WorldInfo) {
  const ok = await confirm(t('content.deleteWorldConfirm', { name: w.name }), { title: t('content.deleteWorldTitle'), kind: 'warning' })
  if (!ok) return
  try {
    await invoke('delete_world', { id: instanceId, folder: w.folder })
    await load()
  } catch (e) {
    toast.add({ title: errorText(e), color: 'error' })
  }
}

async function playWorld(instanceId: string, folder: string) {
  launching.value = `${instanceId}/${folder}`
  await router.push(`/instance/${instanceId}`)
  mc.launch(instanceId, { kind: 'Singleplayer', world: folder }).catch(() => {  })
  launching.value = null
}

onMounted(load)
</script>

<style scoped>
.sw-world {
  padding: 14px 14px 10px;
  border-radius: 14px;
  border: 1px solid var(--sw-line);
  background: var(--sw-surface);
  transition: transform 180ms var(--ease-swift), border-color 180ms var(--ease-swift), background-color 180ms var(--ease-swift);
}
.sw-world:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--sw-accent) 35%, var(--sw-line));
  background: var(--sw-surface-2);
}
.sw-world-play {
  display: flex;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: var(--sw-accent-soft);
  color: var(--sw-accent);
  transition: background-color 160ms var(--ease-swift), color 160ms var(--ease-swift);
}
.sw-world:hover .sw-world-play {
  background: var(--sw-accent);
  color: var(--sw-accent-fg);
}
</style>
