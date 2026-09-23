<template>
  <div class="flex h-full w-full">
    <LayoutSidebar />

    <main class="relative min-w-0 flex-1 overflow-hidden">
      <slot />
    </main>

    <CreateInstanceModal />
    <ExportInstanceModal />
    <ExportModListModal />
    <LinkModsModal />
    <BlockedModsModal />
    <OnboardingModal />
    <RemoveInstanceModal />

    <Transition name="sw-fade">
      <div v-if="dragging" class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/75">
        <div class="flex flex-col items-center gap-3 rounded-xl border border-dashed border-primary/60 bg-[var(--sw-surface)] px-14 py-10">
          <UIcon name="i-lucide-download" class="size-8 text-primary" />
          <p class="font-display text-lg font-semibold text-highlighted">{{ $t('drop.title') }}</p>
          <p class="text-sm text-muted">{{ onInstance ? $t('drop.onInstance') : $t('drop.onHome') }}</p>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import type { UnlistenFn } from '@tauri-apps/api/event'
import type { Instance } from '~/types/launcher'

const instances = useInstancesStore()
const router = useRouter()
const route = useRoute()
const toast = useToast()
const { t } = useI18n()

onMounted(() => {
  instances.ensureLoaded()
})

const dragging = ref(false)
const currentInstanceId = computed(() => (route.path.startsWith('/instance/') ? String(route.params.id) : null))
const onInstance = computed(() => currentInstanceId.value !== null)

let unlistenDrop: UnlistenFn | null = null
onMounted(async () => {
  unlistenDrop = await getCurrentWebview().onDragDropEvent(async (event) => {
    const p = event.payload
    if (p.type === 'enter' || p.type === 'over') {
      dragging.value = true
    } else if (p.type === 'leave') {
      dragging.value = false
    } else if (p.type === 'drop') {
      dragging.value = false
      await handleDrop(p.paths)
    }
  })
})
onBeforeUnmount(() => unlistenDrop?.())

async function handleDrop(paths: string[]) {
  const wanted = paths.filter(p => /\.(mrpack|zip|jar)$/i.test(p))
  if (!wanted.length) return
  try {
    const res = await invoke<{ instances: Instance[], added: number, skipped: number }>('import_dropped', {
      instanceId: currentInstanceId.value,
      paths: wanted,
    })
    if (res.instances.length) {
      await instances.load()
      toast.add({ title: t('drop.imported', { n: res.instances.length }), color: 'success' })
      const first = res.instances[0]
      if (first) router.push(`/instance/${first.id}`)
    }
    if (res.added) {
      toast.add({ title: t('drop.added', { n: res.added }), color: 'success' })
    }
    if (!res.instances.length && !res.added) {
      toast.add({ title: t('drop.nothing'), color: 'neutral' })
    }
  } catch (e) {
    toast.add({ title: errorText(e), color: 'error' })
  }
}

</script>
