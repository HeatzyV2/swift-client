<template>
  <UModal v-model:open="isOpen" :title="title" :ui="{ content: 'max-w-xl' }">
    <template #body>
      <Transition name="sw-fade" mode="out-in">
        <div v-if="step === 'choice'" key="choice" class="grid gap-2">
          <button
            v-for="c in choices"
            :key="c.key"
            type="button"
            class="sw-panel sw-panel-interactive group flex items-center gap-4 p-4 text-left"
            @click="selectChoice(c.key)"
          >
            <span class="flex size-10 shrink-0 items-center justify-center rounded-lg border border-default bg-[var(--sw-canvas)] transition-colors group-hover:border-primary/40">
              <UIcon :name="c.icon" class="size-5 text-toned transition-colors group-hover:text-primary" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-medium text-highlighted">{{ $t(c.title) }}</span>
              <span class="mt-0.5 block text-xs text-muted">{{ $t(c.desc) }}</span>
            </span>
            <UIcon name="i-lucide-chevron-right" class="size-4 text-dimmed transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        <form v-else-if="step === 'custom'" key="custom" class="space-y-5" @submit.prevent="submit">
          <div class="flex items-end gap-3">
            <UDropdownMenu :items="iconMenu">
              <button
                type="button"
                class="flex size-[52px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-default bg-[var(--sw-canvas)] transition-colors hover:border-[var(--sw-line-strong)]"
                :title="$t('create.custom.chooseIcon')"
              >
                <img v-if="form.iconPreview" :src="form.iconPreview" alt="" class="size-full object-cover">
                <UIcon v-else name="i-lucide-image-plus" class="size-5 text-dimmed" />
              </button>
            </UDropdownMenu>
            <UFormField :label="$t('create.custom.name')" class="flex-1">
              <UInput v-model="form.name" :placeholder="namePlaceholder" class="w-full" autofocus />
            </UFormField>
          </div>
          <IconEditorModal v-model:open="iconEditorOpen" @saved="useDrawnIcon" />

          <UFormField :label="$t('create.custom.gameVersion')">
            <template #hint>
              <USwitch v-model="includeSnapshots" size="xs" :label="$t('create.custom.snapshots')" />
            </template>
            <USelectMenu
              v-model="form.mcVersion"
              :items="mcVersions"
              :loading="loadingMc"
              :placeholder="$t('create.custom.gameVersionPlaceholder')"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="$t('create.custom.loader')">
            <div class="grid grid-cols-5 gap-1 rounded-lg border border-default bg-[var(--sw-canvas)] p-1">
              <button
                v-for="l in loaderItems"
                :key="l"
                type="button"
                class="h-8 rounded-md text-[13px] font-medium transition-colors"
                :class="form.loader === l ? 'bg-[var(--sw-surface-3)] text-highlighted shadow-[inset_0_0_0_1px_var(--sw-line-strong)]' : 'text-muted hover:text-toned'"
                @click="form.loader = l"
              >
                {{ loaderLabel(l) }}
              </button>
            </div>
          </UFormField>

          <div class="border-t border-default pt-4">
            <button
              type="button"
              class="flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-highlighted"
              @click="showAdvanced = !showAdvanced"
            >
              <UIcon name="i-lucide-chevron-right" class="size-3.5 transition-transform duration-150" :class="showAdvanced ? 'rotate-90' : ''" />
              {{ $t('create.custom.advanced') }}
            </button>
            <div v-if="showAdvanced" class="mt-4 space-y-3">
              <p v-if="form.loader === 'vanilla'" class="text-xs text-dimmed">{{ $t('create.custom.advancedVanilla') }}</p>
              <template v-else>
                <UFormField :label="$t('create.custom.loaderVersion')">
                  <URadioGroup v-model="form.loaderMode" :items="loaderModeItems" orientation="horizontal" />
                </UFormField>
                <USelectMenu
                  v-if="form.loaderMode === 'other'"
                  v-model="form.loaderExplicit"
                  :items="loaderVersions"
                  :loading="loadingLoader"
                  :placeholder="$t('create.custom.pickLoaderVersion')"
                  class="w-full"
                />
              </template>
            </div>
          </div>

          <p v-if="error" class="flex items-start gap-2 text-sm text-error">
            <UIcon name="i-lucide-circle-alert" class="mt-0.5 size-4 shrink-0" />{{ error }}
          </p>
        </form>

        <div v-else-if="step === 'import'" key="import" class="space-y-6">
          <section v-if="backend.configured.value">
            <p class="text-sm font-medium text-highlighted">{{ $t('create.import.fromCode') }}</p>
            <p class="mb-2 text-xs text-muted">{{ $t('create.import.fromCodeDesc') }}</p>
            <div class="flex gap-2">
              <UInput
                v-model="shareCode"
                placeholder="ABC123"
                maxlength="40"
                class="flex-1 font-mono uppercase tracking-widest"
                @keydown.enter="redeemCode"
              />
              <UButton
                icon="i-lucide-arrow-right"
                :label="$t('create.import.useCode')"
                :loading="redeeming"
                :disabled="shareCode.trim().length < 6"
                @click="redeemCode"
              />
            </div>
          </section>

          <section class="flex items-center justify-between gap-4">
            <div>
              <p class="text-sm font-medium text-highlighted">{{ $t('create.import.fromFile') }}</p>
              <p class="text-xs text-muted">{{ $t('create.import.fromFileDesc') }}</p>
            </div>
            <UButton color="neutral" variant="soft" icon="i-lucide-file-archive" :label="$t('create.import.chooseFile')" :loading="importingFile" @click="importFile" />
          </section>

          <section>
            <div class="mb-2 flex items-center justify-between gap-2">
              <div>
                <p class="text-sm font-medium text-highlighted">{{ $t('create.import.fromLauncher') }}</p>
                <p class="text-xs text-muted">{{ $t('create.import.fromLauncherDesc') }}</p>
              </div>
              <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-refresh-cw" :loading="scanning" square :aria-label="$t('content.refresh')" @click="scanExternal" />
            </div>

            <div v-if="scanning" class="space-y-1.5">
              <div v-for="n in 3" :key="n" class="sw-skeleton h-12" />
            </div>
            <div v-else-if="!external.length" class="rounded-lg border border-dashed border-default py-6 text-center text-sm text-muted">
              {{ $t('create.import.none') }}
            </div>
            <div v-else class="max-h-64 space-y-1.5 overflow-y-auto">
              <div v-for="ext in external" :key="ext.path" class="sw-panel flex items-center gap-3 p-2.5">
                <UBadge color="neutral" variant="subtle" size="sm" :label="launcherLabel(ext.launcher)" />
                <div class="min-w-0 flex-1">
                  <div class="truncate text-sm font-medium text-highlighted">{{ ext.name }}</div>
                  <div class="truncate font-mono text-[11px] text-dimmed">
                    {{ ext.mc_version ?? '?' }}<span v-if="ext.loader"> · {{ ext.loader }}</span>
                  </div>
                </div>
                <UButton
                  size="xs"
                  color="neutral"
                  variant="soft"
                  :label="$t('create.import.importBtn')"
                  :loading="importingPath === ext.path"
                  :disabled="!ext.mc_version || (!!importingPath && importingPath !== ext.path)"
                  @click="importExternal(ext)"
                />
              </div>
            </div>
          </section>

          <p v-if="error" class="flex items-start gap-2 text-sm text-error">
            <UIcon name="i-lucide-circle-alert" class="mt-0.5 size-4 shrink-0" />{{ error }}
          </p>
        </div>
      </Transition>
    </template>

    <template v-if="step !== 'choice'" #footer>
      <div class="flex w-full items-center justify-between gap-3">
        <UButton variant="ghost" color="neutral" icon="i-lucide-arrow-left" :label="$t('create.back')" @click="step = 'choice'" />
        <div v-if="step === 'custom'" class="flex items-center gap-3">
          <span v-if="form.mcVersion" class="hidden truncate font-mono text-xs text-dimmed sm:block">{{ summary }}</span>
          <UButton icon="i-lucide-plus" :label="$t('create.create')" :loading="submitting" :disabled="!canSubmit" @click="submit" />
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import type { DropdownMenuItem } from '@nuxt/ui'
import type { Loader, LoaderType, ExternalInstance, Instance, ShareImportResult } from '~/types/launcher'
import type { LoaderVersionMode } from '~/composables/useMinecraftMeta'

const { isOpen, pendingCode, close } = useCreateInstanceModal()
const toast = useToast()
const instances = useInstancesStore()
const meta = useMinecraftMeta()
const browser = useContentWindow()
const curseforge = useCurseforge()
const blockedModal = useBlockedModsModal()
const activity = useActivityCenter()
const backend = useBackend()
const router = useRouter()
const { t } = useI18n()

type Step = 'choice' | 'custom' | 'modpack' | 'import'
const step = ref<Step>('choice')

const title = computed(() => ({
  choice: t('create.title'),
  custom: t('create.choice.customTitle'),
  modpack: t('create.choice.modpackTitle'),
  import: t('create.choice.importTitle'),
}[step.value]))

const choices = [
  { key: 'custom' as Step, icon: 'i-lucide-box', title: 'create.choice.customTitle', desc: 'create.choice.customDesc' },
  { key: 'modpack' as Step, icon: 'i-lucide-package', title: 'create.choice.modpackTitle', desc: 'create.choice.modpackDesc' },
  { key: 'import' as Step, icon: 'i-lucide-download', title: 'create.choice.importTitle', desc: 'create.choice.importDesc' },
]

function selectChoice(key: Step) {
  if (key === 'modpack') {
    browser.open({ kind: 'modpack', mode: 'createModpack' })
    close()
  } else {
    step.value = key
  }
}

// ---------- import ----------

const external = ref<ExternalInstance[]>([])
const scanning = ref(false)
const importingFile = ref(false)
const importingPath = ref<string | null>(null)

const launcherLabel = (l: ExternalInstance['launcher']) =>
  ({ prism: 'Prism', curseforge: 'CurseForge', modrinth: 'Modrinth' }[l] ?? l)

async function scanExternal() {
  scanning.value = true
  error.value = null
  try {
    external.value = await invoke<ExternalInstance[]>('detect_external_instances')
  } catch (e) {
    error.value = errorText(e)
  } finally {
    scanning.value = false
  }
}

async function openCreated(instance: Instance) {
  await instances.load()
  instances.select(instance.id)
  close()
  router.push(`/instance/${instance.id}`)
}

async function showBlocked(instanceId: string) {
  if (!backend.configured.value) return
  const blocked = await curseforge.getBlocked(instanceId).catch(() => [])
  if (blocked.length) blockedModal.open(instanceId)
}

async function importFile() {
  try {
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [{ name: 'Modpack', extensions: ['mrpack', 'zip'] }],
    })
    if (typeof selected !== 'string') return
    importingFile.value = true
    error.value = null
    const tid = activity.startTask(t('activity.importingModpack'))
    try {
      const instance = await invoke<Instance>('import_file', { path: selected, nameOverride: null })
      await openCreated(instance)
      await showBlocked(instance.id)
    } finally {
      activity.endTask(tid)
      importingFile.value = false
    }
  } catch (e) {
    error.value = errorText(e)
  }
}

const shareCode = ref('')
const redeeming = ref(false)

async function redeemCode() {
  const code = shareCode.value.trim()
  if (code.length < 6 || redeeming.value) return
  redeeming.value = true
  error.value = null
  const tid = activity.startTask(t('activity.importingModpack'))
  try {
    const res = await invoke<ShareImportResult>('import_share', { code })
    await openCreated(res.instance)
    if (res.needs_curseforge) {
      toast.add({ title: t('share.needsCurseforge', { n: res.needs_curseforge }), color: 'warning' })
    }
    if (res.failed.length) {
      toast.add({ title: t('share.someFailed', { n: res.failed.length }), description: res.failed.join(', '), color: 'warning' })
    }
    await showBlocked(res.instance.id)
  } catch (e) {
    error.value = errorText(e)
  } finally {
    activity.endTask(tid)
    redeeming.value = false
  }
}

async function importExternal(ext: ExternalInstance) {
  if (!ext.mc_version) return
  importingPath.value = ext.path
  error.value = null
  const tid = activity.startTask(t('activity.importingInstance', { name: ext.name }))
  try {
    const instance = await invoke<Instance>('import_external_instance', {
      name: ext.name,
      gameDir: ext.game_dir,
      mcVersion: ext.mc_version,
      loader: ext.loader,
      loaderVersion: ext.loader_version,
    })
    await openCreated(instance)
  } catch (e) {
    error.value = errorText(e)
  } finally {
    activity.endTask(tid)
    importingPath.value = null
  }
}

// ---------- custom ----------

const form = reactive({
  name: '',
  iconPath: null as string | null,
  iconData: null as string | null,
  iconPreview: null as string | null,
  loader: 'vanilla' as LoaderType,
  mcVersion: '',
  loaderMode: 'stable' as LoaderVersionMode,
  loaderExplicit: '',
})
const includeSnapshots = ref(false)
const showAdvanced = ref(false)
const error = ref<string | null>(null)
const submitting = ref(false)

const loaderItems: LoaderType[] = ['vanilla', 'fabric', 'neoforge', 'forge', 'quilt']
const loaderModeItems = computed(() => [
  { label: t('create.custom.stable'), value: 'stable' },
  { label: t('create.custom.latest'), value: 'latest' },
  { label: t('create.custom.other'), value: 'other' },
])

const mcVersions = ref<string[]>([])
const loadingMc = ref(false)
const loaderVersions = ref<string[]>([])
const loadingLoader = ref(false)

const namePlaceholder = computed(() => `${loaderLabel(form.loader)} ${form.mcVersion}`.trim())
const summary = computed(() => {
  const loader = form.loader === 'vanilla'
    ? loaderLabel('vanilla')
    : `${loaderLabel(form.loader)} (${form.loaderMode === 'other' ? form.loaderExplicit || '?' : t(`create.custom.${form.loaderMode}`)})`
  return `${form.mcVersion} · ${loader}`
})

const canSubmit = computed(() => {
  if (!form.mcVersion) return false
  if (form.loader !== 'vanilla' && form.loaderMode === 'other' && !form.loaderExplicit) return false
  return true
})

const iconEditorOpen = ref(false)

const iconMenu = computed<DropdownMenuItem[][]>(() => [[
  { label: t('iconEditor.create'), icon: 'i-lucide-palette', onSelect: () => { iconEditorOpen.value = true } },
  { label: t('create.custom.chooseIcon'), icon: 'i-lucide-upload', onSelect: chooseIcon },
  ...(form.iconPreview ? [{ label: t('create.custom.removeIcon'), icon: 'i-lucide-x', onSelect: clearIcon }] : []),
]])

function useDrawnIcon(dataUrl: string) {
  form.iconData = dataUrl
  form.iconPreview = dataUrl
  form.iconPath = null
}

async function chooseIcon() {
  try {
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'] }],
    })
    if (typeof selected !== 'string') return
    form.iconPath = selected
    form.iconData = null
    form.iconPreview = await invoke<string>('read_image_data_url', { path: selected })
  } catch (e) {
    error.value = errorText(e)
  }
}

function clearIcon() {
  form.iconPath = null
  form.iconData = null
  form.iconPreview = null
}

async function loadMcVersions() {
  loadingMc.value = true
  try {
    const list = await meta.getMinecraftVersions(includeSnapshots.value)
    mcVersions.value = list.map(v => v.id)
    if (!mcVersions.value.includes(form.mcVersion)) form.mcVersion = mcVersions.value[0] ?? ''
  } catch (e) {
    error.value = errorText(e)
  } finally {
    loadingMc.value = false
  }
}

async function loadLoaderVersions() {
  if (form.loader === 'vanilla' || !form.mcVersion) {
    loaderVersions.value = []
    return
  }
  loadingLoader.value = true
  try {
    const list = await meta.getLoaderVersions(form.loader, form.mcVersion)
    loaderVersions.value = list.map(v => v.version)
  } catch (e) {
    loaderVersions.value = []
    error.value = errorText(e)
  } finally {
    loadingLoader.value = false
  }
}

watch(
  () => [step.value, includeSnapshots.value] as const,
  ([s]) => {
    if (s === 'custom') loadMcVersions()
    else if (s === 'import' && !external.value.length) scanExternal()
  },
)

watch(
  () => [form.loader, form.mcVersion, form.loaderMode] as const,
  () => {
    form.loaderExplicit = ''
    if (form.loaderMode === 'other') loadLoaderVersions()
  },
)

watch(isOpen, (isNowOpen) => {
  if (isNowOpen) {
    if (pendingCode.value && backend.configured.value) {
      shareCode.value = pendingCode.value
      step.value = 'import'
    }
    pendingCode.value = null
    return
  }

  step.value = 'choice'
  shareCode.value = ''
  redeeming.value = false
  clearIcon()
  form.name = ''
  form.loader = 'vanilla'
  form.mcVersion = ''
  form.loaderMode = 'stable'
  form.loaderExplicit = ''
  includeSnapshots.value = false
  showAdvanced.value = false
  error.value = null
  external.value = []
  importingFile.value = false
  importingPath.value = null
})

async function submit() {
  if (!canSubmit.value || submitting.value) return
  error.value = null
  submitting.value = true
  try {
    let loader: Loader
    if (form.loader === 'vanilla') {
      loader = { type: 'vanilla' }
    } else {
      const version = await meta.resolveLoaderVersion(form.loader, form.mcVersion, form.loaderMode, form.loaderExplicit)
      loader = { type: form.loader, version } as Loader
    }
    const created = await instances.create({
      name: form.name.trim() || namePlaceholder.value,
      mcVersion: form.mcVersion,
      loader,
      iconSourcePath: form.iconPath,
    })
    if (form.iconData) {
      await invoke('set_instance_icon_data', { id: created.id, dataUrl: form.iconData })
      created.icon = 'icon.png'
      invalidateInstanceIcon(created.id)
    }
    close()
    toast.add({ title: t('create.done', { name: created.name }), color: 'success', icon: 'i-lucide-check' })
    router.push(`/instance/${created.id}`)
  } catch (e) {
    error.value = errorText(e)
  } finally {
    submitting.value = false
  }
}
</script>
