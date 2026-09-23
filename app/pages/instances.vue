<template>
  <div class="h-full">
    <UContextMenu :items="contextItems">
      <div class="h-full overflow-y-auto px-8 py-7" @contextmenu.capture="onContext">
        <UiPageHeader :title="$t('library.title')" :subtitle="$t('library.count', { n: instances.instances.length })">
          <UInput v-model="search" icon="i-lucide-search" :placeholder="$t('library.search')" class="w-60" />
          <USelect v-model="loaderFilter" :items="loaderFilterItems" class="w-36" />
          <UButton icon="i-lucide-plus" :label="$t('nav.newInstance')" @click="openCreate()" />
        </UiPageHeader>

        <div v-if="instances.loading && !instances.loaded" class="grid gap-3" :style="GRID">
          <div v-for="n in 8" :key="n" class="sw-panel flex items-center gap-3 p-3">
            <div class="sw-skeleton size-11 shrink-0" />
            <div class="flex-1 space-y-2">
              <div class="sw-skeleton h-3.5 w-3/4" />
              <div class="sw-skeleton h-2.5 w-2/5" />
            </div>
          </div>
        </div>

        <UiEmptyState
          v-else-if="instances.error && !instances.instances.length"
          icon="i-lucide-triangle-alert"
          :title="$t('library.loadError')"
          :description="instances.error"
        >
          <UButton color="neutral" variant="soft" icon="i-lucide-rotate-cw" :label="$t('common.retry')" @click="instances.load()" />
        </UiEmptyState>

        <UiEmptyState
          v-else-if="!instances.instances.length"
          icon="i-lucide-layers"
          :title="$t('library.empty')"
          :description="$t('library.emptyHint')"
        >
          <UButton icon="i-lucide-plus" :label="$t('nav.newInstance')" @click="openCreate()" />
        </UiEmptyState>

        <UiEmptyState
          v-else-if="filtering && totalVisible === 0"
          icon="i-lucide-search-x"
          :title="$t('library.noResults')"
        />

        <VueDraggable
          v-else
          v-model="layout.groups.value"
          :animation="150"
          :disabled="filtering"
          :force-fallback="true"
          :fallback-on-body="true"
          handle=".sw-group-handle"
          ghost-class="sw-group-ghost"
          class="space-y-8"
          @end="layout.onGroupsReordered()"
        >
          <section v-for="group in layout.groups.value" v-show="!filtering || visibleCount(group) > 0" :key="group.id">
            <div class="group/h mb-3 flex items-center gap-2">
              <button
                type="button"
                class="flex items-center gap-1.5 rounded py-0.5 text-[13px] font-semibold text-toned transition-colors hover:text-highlighted"
                @click="layout.toggleCollapse(group.id)"
              >
                <UIcon
                  name="i-lucide-chevron-right"
                  class="size-4 text-dimmed transition-transform duration-150"
                  :class="group.collapsed ? '' : 'rotate-90'"
                />
                {{ group.name ?? $t('library.ungrouped') }}
              </button>
              <span class="font-mono text-[11px] text-dimmed">{{ filtering ? visibleCount(group) : group.items.length }}</span>
              <UIcon
                v-if="group.name && !filtering"
                name="i-lucide-grip-vertical"
                class="sw-group-handle size-4 cursor-grab text-dimmed opacity-0 transition hover:text-toned group-hover/h:opacity-100 active:cursor-grabbing"
                :title="$t('library.dragGroup')"
              />
              <div class="h-px flex-1 bg-[var(--sw-line-soft)]" />
              <UButton
                v-if="group.name"
                icon="i-lucide-trash-2"
                size="xs"
                color="neutral"
                variant="ghost"
                class="opacity-0 transition group-hover/h:opacity-100"
                :title="$t('library.deleteGroup')"
                @click="layout.removeGroup(group.id)"
              />
            </div>

            <VueDraggable
              v-show="!group.collapsed"
              v-model="group.items"
              group="library"
              :animation="150"
              :disabled="filtering"
              :force-fallback="true"
              :fallback-on-body="true"
              :fallback-tolerance="6"
              ghost-class="sw-card-ghost"
              class="grid min-h-16 gap-3"
              :style="GRID"
              @end="onInstanceDragEnd"
              @start="onInstanceDragStart"
            >
              <InstanceLibraryCard
                v-for="item in group.items"
                v-show="matches(item)"
                :key="item.id"
                :data-instance-id="item.id"
                :instance="item"
                :selected="item.id === instances.selectedId"
                :busy="busy(item.id)"
                :running="running(item.id)"
                @click="enter(item.id)"
                @play="quickPlay(item)"
              />
            </VueDraggable>
          </section>
        </VueDraggable>
      </div>
    </UContextMenu>

    <UModal v-model:open="createGroupOpen" :title="$t('library.createGroupTitle')">
      <template #body>
        <UFormField :label="$t('library.groupName')">
          <UInput
            v-model="newGroupName"
            :placeholder="$t('library.groupNamePlaceholder')"
            autofocus
            class="w-full"
            @keydown.enter="confirmCreateGroup"
          />
        </UFormField>
      </template>
      <template #footer>
        <div class="flex w-full items-center gap-3">
          <ModalHint>{{ $t('library.groupHint') }}</ModalHint>
          <div class="ml-auto flex shrink-0 gap-2">
            <UButton variant="ghost" color="neutral" :label="$t('common.cancel')" @click="createGroupOpen = false" />
            <UButton :label="$t('common.add')" :disabled="!newGroupName.trim()" @click="confirmCreateGroup" />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import { VueDraggable } from 'vue-draggable-plus'
import type { Instance, LoaderType } from '~/types/launcher'
import type { DisplayGroup } from '~/composables/useLibraryLayout'

const GRID = 'grid-template-columns:repeat(auto-fill,minmax(260px,1fr))'

const instances = useInstancesStore()
const layout = useLibraryLayout()
const launchFlow = useLaunchFlow()
const activity = useActivityCenter()
const router = useRouter()
const toast = useToast()
const { t } = useI18n()
const { open: openCreate } = useCreateInstanceModal()

onMounted(async () => {
  await instances.ensureLoaded()
  layout.reconcile(instances.instances)
})

watch(
  () => instances.instances.map(i => i.id).join(','),
  () => layout.reconcile(instances.instances),
)

const search = ref('')
const loaderFilter = ref<'all' | LoaderType>('all')
const loaderFilterItems = computed(() => [
  { label: t('library.allLoaders'), value: 'all' },
  ...(Object.keys(LOADER_LABELS) as LoaderType[]).map(value => ({ label: loaderLabel(value), value })),
])

const filtering = computed(() => !!search.value.trim() || loaderFilter.value !== 'all')

function matches(item: Instance): boolean {
  if (loaderFilter.value !== 'all' && item.loader.type !== loaderFilter.value) return false
  if (search.value && !item.name.toLowerCase().includes(search.value.toLowerCase())) return false
  return true
}
const visibleCount = (group: DisplayGroup) => group.items.filter(matches).length
const totalVisible = computed(() => layout.groups.value.reduce((n, g) => n + visibleCount(g), 0))

let suppressClickUntil = 0
const dragJustEnded = () => Date.now() < suppressClickUntil

const enter = (id: string) => {
  if (dragJustEnded()) return
  router.push(`/instance/${id}`)
}

const busy = (id: string) => activity.list.value.some(a => a.instanceId === id)
const running = (id: string) => activity.list.value.some(a => a.instanceId === id && a.kind === 'running')

const quickPlay = (item: Instance) => {
  if (dragJustEnded() || busy(item.id)) return
  launchFlow.play(item.id)
}

const onInstanceDragStart = () => {
  suppressClickUntil = Number.POSITIVE_INFINITY
}
const onInstanceDragEnd = () => {
  layout.persist()
  suppressClickUntil = Date.now() + 150
}

async function runCommand(command: string, args: Record<string, unknown>, success?: string) {
  try {
    await invoke(command, args)
    if (success) toast.add({ title: success, color: 'success' })
  } catch (e) {
    toast.add({ title: errorText(e), color: 'error' })
  }
}

async function duplicate(item: Instance) {
  await runCommand('duplicate_instance', { id: item.id })
  await instances.load()
}

async function copyPath(item: Instance) {
  try {
    const path = await invoke<string>('get_instance_path', { id: item.id })
    await navigator.clipboard.writeText(path)
    toast.add({ title: t('library.copied'), color: 'success' })
  } catch (e) {
    toast.add({ title: errorText(e), color: 'error' })
  }
}

const contextTarget = ref<Instance | null>(null)

function onContext(e: MouseEvent) {
  const el = (e.target as HTMLElement | null)?.closest('[data-instance-id]') as HTMLElement | null
  const id = el?.dataset.instanceId
  contextTarget.value = id ? instances.instances.find(i => i.id === id) ?? null : null
}

const emptyMenu = computed(() => [[
  { label: t('library.createGroup'), icon: 'i-lucide-folder-plus', onSelect: openCreateGroup },
  { label: t('nav.newInstance'), icon: 'i-lucide-plus', onSelect: () => openCreate() },
]])

function instanceMenu(item: Instance) {
  return [
    [
      { label: t('ctx.play'), icon: 'i-lucide-play', onSelect: () => launchFlow.play(item.id) },
      { label: t('ctx.view'), icon: 'i-lucide-eye', onSelect: () => enter(item.id) },
      { label: t('library.select'), icon: 'i-lucide-star', onSelect: () => instances.select(item.id) },
      { label: t('ctx.duplicate'), icon: 'i-lucide-copy', onSelect: () => duplicate(item) },
    ],
    [
      { label: t('instance.createShortcut'), icon: 'i-lucide-app-window', onSelect: () => runCommand('create_desktop_shortcut', { id: item.id }, t('instance.shortcutCreated')) },
      { label: t('ctx.openFolder'), icon: 'i-lucide-folder', onSelect: () => runCommand('open_instance_folder', { id: item.id }) },
      { label: t('ctx.copyPath'), icon: 'i-lucide-clipboard', onSelect: () => copyPath(item) },
    ],
    [
      { label: t('common.remove'), icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => confirmRemove.request(item) },
    ],
  ]
}

const contextItems = computed(() =>
  contextTarget.value ? instanceMenu(contextTarget.value) : emptyMenu.value,
)

const confirmRemove = useConfirmRemoveInstance()

const createGroupOpen = ref(false)
const newGroupName = ref('')

function openCreateGroup() {
  newGroupName.value = ''
  createGroupOpen.value = true
}
function confirmCreateGroup() {
  if (!newGroupName.value.trim()) return
  layout.createGroup(newGroupName.value)
  createGroupOpen.value = false
}
</script>

<style>
.sw-card-ghost {
  opacity: 0.4;
  border-style: dashed;
  border-color: var(--ui-primary);
}
.sw-group-ghost {
  opacity: 0.5;
}
.sortable-fallback {
  opacity: 1 !important;
  background: var(--sw-surface-2) !important;
  border-color: var(--ui-primary) !important;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55);
}
</style>
