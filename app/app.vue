<template>
  <UApp class="overflow-hidden" :toaster="{ position: 'bottom-right', duration: 4000 }">
    <LayoutTopBar :compact="isContentWindow" />

    <NuxtLoadingIndicator color="var(--sw-accent)" :height="2" />

    <div class="relative h-screen w-screen overflow-hidden pt-[60px]">
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

const { t, locale } = useI18n()

const route = useRoute()
const isContentWindow = computed(() => route.path.startsWith('/browser'))

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

function discordScreenFromPath(path: string): string {
  if (path === '/' || path === '') return 'home'
  if (path.startsWith('/instance/')) return 'instance'
  if (path.startsWith('/instances')) return 'instances'
  if (path.startsWith('/social')) return 'social'
  if (path.startsWith('/worlds')) return 'worlds'
  if (path.startsWith('/screenshots')) return 'screenshots'
  if (path.startsWith('/skins')) return 'skins'
  if (path.startsWith('/settings')) return 'settings'
  return 'home'
}

function syncDiscordPresence() {
  if (isContentWindow.value) return
  invoke('discord_sync', {
    locale: locale.value,
    screen: discordScreenFromPath(route.path),
  }).catch(() => {})
}

async function openInstanceAndPlay(instanceId: string) {
  await instances.ensureLoaded()
  if (!instances.instances.some(i => i.id === instanceId)) return
  await router.push(`/instance/${instanceId}`)
  launchFlow.play(instanceId)
}

watch([locale, () => route.path], () => syncDiscordPresence())

onMounted(async () => {
  if (isContentWindow.value) return

  syncDiscordPresence()
  activity.attach()
  activity.withTask(t('activity.optimizing'), () => invoke('migrate_shared_dirs')).catch(() => {})
  instances.ensureLoaded()
  accounts.ensureLoaded()

  // One-shot toast when Sync was just introduced on an existing install.
  invoke<boolean>('take_sync_announcement').then((show) => {
    if (!show) return
    toast.add({
      title: t('sync.announceTitle'),
      description: t('sync.announceDesc'),
      icon: 'i-lucide-refresh-cw',
      color: 'primary',
      actions: [{
        label: t('sync.announceAction'),
        onClick: () => {
          router.push('/settings?section=sync')
          invoke('mark_sync_announcement_seen').catch(() => {})
        },
      }],
    })
    invoke('mark_sync_announcement_seen').catch(() => {})
  }).catch(() => {})

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
