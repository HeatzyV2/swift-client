<template>
  <UApp class="overflow-hidden" :toaster="{ position: 'bottom-right', duration: 4000 }">
    <header
      data-tauri-drag-region
      class="fixed inset-x-0 top-0 z-[100] flex h-10 items-center justify-between select-none"
      @pointerdown.self.stop
    >
      <div data-tauri-drag-region class="flex h-full items-center" :class="isMac ? 'pl-[78px]' : 'pl-4'">
        <BrandWordmark :compact="isContentWindow" />
        <span v-if="isContentWindow" class="ml-3 text-xs text-dimmed">{{ $t('browserWindow.title') }}</span>
      </div>
      <div class="flex h-full items-center gap-2">
        <TitlebarActivity v-if="!isContentWindow" />
        <WindowControls />
      </div>
    </header>

    <NuxtLoadingIndicator color="var(--sw-accent)" :height="2" />

    <div class="relative h-screen w-screen overflow-hidden pt-10">
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </div>

    <template v-if="!isContentWindow">
      <LiveLogsModal />
      <CrashReportModal />
      <PrelaunchModal />
    </template>
  </UApp>
</template>

<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { UnlistenFn } from '@tauri-apps/api/event'

const { t } = useI18n()

const route = useRoute()
const isContentWindow = computed(() => route.path.startsWith('/browser'))

const { platform } = usePlatform()
const isMac = computed(() => platform.value === 'macos')

const activity = useActivityCenter()
const instances = useInstancesStore()
const accounts = useAccountStore()
const router = useRouter()
const launchFlow = useLaunchFlow()
const createModal = useCreateInstanceModal()
const backend = useBackend()
const contentWindow = useContentWindow()

useHead({ title: BRAND.name })

const unlisteners: UnlistenFn[] = []

async function openInstanceAndPlay(instanceId: string) {
  await instances.ensureLoaded()
  if (!instances.instances.some(i => i.id === instanceId)) return
  await router.push(`/instance/${instanceId}`)
  launchFlow.play(instanceId)
}

onMounted(async () => {
  if (isContentWindow.value) return

  activity.attach()
  activity.withTask(t('activity.optimizing'), () => invoke('migrate_shared_dirs')).catch(() => {})
  instances.ensureLoaded()
  accounts.ensureLoaded()

  // Desktop shortcuts: swift://launch/<id>
  unlisteners.push(await listen<string>('launch://open', async (e) => {
    await invoke('take_pending_launch').catch(() => {})
    openInstanceAndPlay(e.payload)
  }))
  const pendingLaunch = await invoke<string | null>('take_pending_launch').catch(() => null)
  if (pendingLaunch) openInstanceAndPlay(pendingLaunch)

  unlisteners.push(await contentWindow.onInstalled(async ({ instance }) => {
    await instances.load()
    if (instance) router.push(`/instance/${instance.id}`)
  }))

  // Share codes (swift://share/<code>) only exist with the online service.
  await backend.ready
  if (backend.configured.value) {
    unlisteners.push(await listen<string>('share://open', async (e) => {
      await invoke('take_pending_share').catch(() => {})
      createModal.openWithCode(e.payload)
    }))
    const pendingShare = await invoke<string | null>('take_pending_share').catch(() => null)
    if (pendingShare) createModal.openWithCode(pendingShare)
  }
})

onBeforeUnmount(() => {
  for (const off of unlisteners) off()
  if (!isContentWindow.value) activity.detach()
})
</script>
