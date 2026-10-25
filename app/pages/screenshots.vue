<template>
  <div class="h-full overflow-y-auto">
    <div class="sw-page">
      <UiPageHeader icon="i-lucide-camera" :title="$t('screenshotsPage.title')" :subtitle="$t('screenshotsPage.count', { shots: totalShots, instances: groups.length })">
        <UButton icon="i-lucide-refresh-cw" color="neutral" variant="soft" :loading="loading" :label="$t('content.refresh')" @click="load" />
      </UiPageHeader>

      <div v-if="loading" class="space-y-8">
        <div v-for="g in 2" :key="`g-sk-${g}`">
          <div class="sw-skeleton mb-4 h-4 w-48" />
          <div class="grid gap-3.5" :style="GRID">
            <div v-for="n in 4" :key="`s-sk-${n}`" class="sw-skeleton aspect-video rounded-[14px]" />
          </div>
        </div>
      </div>

      <UiEmptyState v-else-if="!groups.length" icon="i-lucide-camera" :title="$t('screenshotsPage.empty')" />

      <div v-else class="space-y-9">
        <section v-for="group in groups" :key="group.instance.id">
          <div class="sw-section-head">
            <button type="button" class="group/h flex min-w-0 items-center gap-2.5" @click="router.push(`/instance/${group.instance.id}`)">
              <InstanceIcon :instance="group.instance" class="size-7 rounded-[7px] text-[12px]" />
              <span class="sw-eyebrow truncate text-[12px] transition-colors group-hover/h:text-highlighted">{{ group.instance.name }}</span>
              <span class="font-mono text-[11px] text-dimmed">{{ group.instance.mc_version }}</span>
            </button>
            <span class="order-last rounded-full bg-[var(--sw-surface-2)] px-2 py-0.5 text-[11px] text-muted">{{ $t('screenshotsPage.instanceShots', { n: group.shots.length }) }}</span>
          </div>

          <div class="grid gap-3.5" :style="GRID">
            <button
              v-for="s in group.shots"
              :key="s.path"
              type="button"
              class="sw-shot group"
              @click="openLightbox(s)"
            >
              <ThumbImage :path="s.path" :size="440" :alt="s.name" class="aspect-video w-full object-cover transition-[scale] duration-300 ease-[var(--ease-swift)] group-hover:scale-[1.05]" />
              <span class="absolute inset-0 bg-[linear-gradient(to_top,rgb(5_7_11/0.85)_0%,transparent_45%)] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
              <span class="absolute inset-x-0 bottom-0 flex items-center gap-2 px-3 pb-2.5 text-[12px] font-medium text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <UIcon name="i-lucide-maximize-2" class="size-3.5 shrink-0" />
                <span class="truncate" :title="s.name">{{ s.name }}</span>
              </span>
            </button>
          </div>
        </section>
      </div>
    </div>

    <UModal v-model:open="lightboxOpen" :ui="{ content: 'max-w-5xl w-[92vw]' }">
      <template #content>
        <div v-if="lightbox" class="flex flex-col">
          <div class="flex items-center justify-between gap-2 border-b border-default px-4 py-2.5">
            <span class="truncate text-sm font-medium" :title="lightbox.shot.name">
              {{ lightbox.shot.name }}
              <span class="ml-1 text-xs text-muted">{{ (lightboxIndex ?? 0) + 1 }} / {{ flatShots.length }}</span>
              <span class="ml-2 text-xs text-neutral-500">· {{ lightbox.instance.name }}</span>
            </span>
            <div class="flex items-center gap-1.5">
              <UButton icon="i-lucide-download" size="xs" color="neutral" variant="soft" :label="$t('content.download')" @click="downloadShot(lightbox.shot)" />
              <UButton icon="i-lucide-folder" size="xs" color="neutral" variant="soft" :label="$t('content.openLocation')" @click="revealShot(lightbox.shot)" />
              <UButton icon="i-lucide-trash-2" size="xs" color="error" variant="soft" :label="$t('common.remove')" @click="deleteShot(lightbox.instance.id, lightbox.shot)" />
              <UButton icon="i-lucide-x" size="xs" color="neutral" variant="ghost" square @click="lightboxIndex = null" />
            </div>
          </div>

          <div class="relative bg-black/40">
            <img :src="assetUrl(lightbox.shot.path)" class="max-h-[78vh] w-full object-contain" :alt="lightbox.shot.name" >
            <UButton
              v-if="flatShots.length > 1"
              icon="i-lucide-chevron-left"
              color="neutral"
              class="absolute top-1/2 left-2 -translate-y-1/2 rounded-full opacity-80 hover:opacity-100"
              @click="step(-1)"
            />
            <UButton
              v-if="flatShots.length > 1"
              icon="i-lucide-chevron-right"
              color="neutral"
              class="absolute top-1/2 right-2 -translate-y-1/2 rounded-full opacity-80 hover:opacity-100"
              @click="step(1)"
            />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import { save, confirm } from '@tauri-apps/plugin-dialog'
import type { Instance, ScreenshotInfo } from '~/types/launcher'

const GRID = 'grid-template-columns:repeat(auto-fill,minmax(240px,1fr))'

const instances = useInstancesStore()
const router = useRouter()
const toast = useToast()
const { t } = useI18n()

interface ShotGroup { instance: Instance; shots: ScreenshotInfo[] }
const groups = ref<ShotGroup[]>([])
const loading = ref(true)

const totalShots = computed(() => groups.value.reduce((n, g) => n + g.shots.length, 0))
const flatShots = computed(() =>
  groups.value.flatMap(g => g.shots.map(shot => ({ shot, instance: g.instance }))),
)


async function load() {
  loading.value = true
  try {
    await instances.ensureLoaded()
    const settled = await Promise.all(
      instances.instances.map(async (instance: Instance) => {
        try {
          const shots = await invoke<ScreenshotInfo[]>('list_screenshots', { id: instance.id })
          return { instance, shots }
        } catch {
          return { instance, shots: [] as ScreenshotInfo[] }
        }
      }),
    )
    groups.value = settled.filter((g: ShotGroup) => g.shots.length > 0)
  } finally {
    loading.value = false
  }
}

const lightboxIndex = ref<number | null>(null)
const lightbox = computed(() => (lightboxIndex.value !== null ? flatShots.value[lightboxIndex.value] ?? null : null))
const lightboxOpen = computed({
  get: () => lightboxIndex.value !== null,
  set: (v: boolean) => { if (!v) lightboxIndex.value = null },
})

function openLightbox(s: ScreenshotInfo) {
  lightboxIndex.value = flatShots.value.findIndex(f => f.shot.path === s.path)
}
function step(delta: number) {
  if (lightboxIndex.value === null || !flatShots.value.length) return
  const n = flatShots.value.length
  lightboxIndex.value = (lightboxIndex.value + delta + n) % n
}

function onKey(e: KeyboardEvent) {
  if (lightboxIndex.value === null) return
  if (e.key === 'ArrowRight') { e.preventDefault(); step(1) }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1) }
  else if (e.key === 'Escape') lightboxIndex.value = null
}

async function downloadShot(s: ScreenshotInfo) {
  try {
    const dest = await save({ defaultPath: s.name, filters: [{ name: 'PNG', extensions: ['png'] }] })
    if (!dest) return
    await invoke('copy_file', { from: s.path, to: dest })
    toast.add({ title: t('content.downloaded'), color: 'success' })
  } catch (e) {
    toast.add({ title: errorText(e), color: 'error' })
  }
}

async function revealShot(s: ScreenshotInfo) {
  try {
    await invoke('reveal_in_explorer', { path: s.path })
  } catch (e) {
    toast.add({ title: errorText(e), color: 'error' })
  }
}

async function deleteShot(instanceId: string, s: ScreenshotInfo) {
  const ok = await confirm(t('content.deleteScreenshotConfirm'), { title: t('content.deleteScreenshotTitle'), kind: 'warning' })
  if (!ok) return
  try {
    await invoke('delete_screenshot', { id: instanceId, name: s.name })
    lightboxIndex.value = null
    await load()
  } catch (e) {
    toast.add({ title: errorText(e), color: 'error' })
  }
}

onMounted(() => {
  load()
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
.sw-shot {
  position: relative;
  display: block;
  overflow: hidden;
  border-radius: 14px;
  border: 1px solid var(--sw-line);
  background: var(--sw-surface);
  text-align: left;
  transition: transform 180ms var(--ease-swift), border-color 180ms var(--ease-swift), box-shadow 180ms var(--ease-swift);
}
.sw-shot:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--sw-accent) 40%, var(--sw-line));
  box-shadow: var(--shadow-md);
}
</style>
