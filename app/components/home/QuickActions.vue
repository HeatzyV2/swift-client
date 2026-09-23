<template>
  <section class="flex flex-col gap-6">
    <div>
      <h3 class="sw-eyebrow mb-3">{{ $t('home.shortcuts') }}</h3>
      <div class="sw-panel flex flex-col p-1.5">
        <button
          v-for="action in actions"
          :key="action.label"
          type="button"
          class="flex items-center gap-3 rounded-md px-3 py-2 text-left text-[13px] text-toned transition-colors hover:bg-[var(--sw-surface-2)] hover:text-highlighted"
          @click="action.run"
        >
          <UIcon :name="action.icon" class="size-4 shrink-0 text-dimmed" />
          <span class="flex-1">{{ action.label }}</span>
        </button>
      </div>
    </div>

    <div>
      <h3 class="sw-eyebrow mb-3">{{ $t('home.overview') }}</h3>
      <div class="sw-panel grid grid-cols-2 divide-x divide-[var(--sw-line-soft)]">
        <div class="px-4 py-3">
          <div class="font-display text-xl font-semibold text-highlighted">{{ instances.instances.length }}</div>
          <div class="text-xs text-dimmed">{{ $t('home.instancesCount') }}</div>
        </div>
        <div class="px-4 py-3">
          <div class="font-display text-xl font-semibold text-highlighted">{{ totalPlaytime }}</div>
          <div class="text-xs text-dimmed">{{ $t('home.totalPlaytime') }}</div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import type { Instance } from '~/types/launcher'

const props = defineProps<{ instance: Instance }>()

const instances = useInstancesStore()
const browser = useContentWindow()
const router = useRouter()
const toast = useToast()
const { t } = useI18n()
const { open: openCreate } = useCreateInstanceModal()

const totalPlaytime = computed(() =>
  formatPlaytime(instances.instances.reduce((sum, i) => sum + (i.playtime_seconds ?? 0), 0)),
)

async function openGameFolder() {
  try {
    await invoke('open_instance_game_folder', { id: props.instance.id })
  } catch (e) {
    toast.add({ title: errorText(e), color: 'error' })
  }
}

const actions = computed(() => [
  { icon: 'i-lucide-blocks', label: t('home.actions.content'), run: () => router.push({ path: `/instance/${props.instance.id}`, query: { tab: 'content' } }) },
  { icon: 'i-lucide-folder-open', label: t('home.actions.gameFolder'), run: openGameFolder },
  { icon: 'i-lucide-sliders-horizontal', label: t('home.actions.details'), run: () => router.push(`/instance/${props.instance.id}`) },
  { icon: 'i-lucide-package', label: t('home.actions.modpacks'), run: () => browser.open({ kind: 'modpack', mode: 'createModpack' }) },
  { icon: 'i-lucide-plus', label: t('nav.newInstance'), run: () => openCreate() },
])
</script>
