<template>
  <UModal v-model:open="open" :ui="{ content: 'max-w-xl overflow-hidden' }">
    <template #content>
      <UCommandPalette
        v-model:search-term="term"
        :groups="groups"
        :placeholder="$t('swiftx.palette.placeholder')"
        :ui="{ input: '[&_input]:font-display' }"
        class="h-[min(440px,72vh)]"
        close
        @update:open="(v: boolean) => { open = v }"
      >
        <template #empty>
          <div class="flex flex-col items-center gap-3 px-6 py-8 text-center">
            <BrandMascot pose="sleep" class="h-[64px] w-auto" />
            <p class="font-display text-base text-muted">{{ $t('swiftx.palette.empty') }}</p>
          </div>
        </template>
      </UCommandPalette>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { CommandPaletteGroup, CommandPaletteItem } from '@nuxt/ui'

const { open, cardOpen } = useCommandPalette()
const { t } = useI18n()
const router = useRouter()
const instances = useInstancesStore()
const launchFlow = useLaunchFlow()
const createModal = useCreateInstanceModal()

const term = ref('')
watch(open, (v) => {
  if (v) term.value = ''
})

function run(fn: () => unknown): () => void {
  return () => {
    open.value = false
    // Let the dialog close first so a modal opened by the action is not closed with it
    setTimeout(fn, 60)
  }
}

const pages = [
  { to: '/', icon: 'i-lucide-house', label: 'nav.home' },
  { to: '/instances', icon: 'i-lucide-layout-grid', label: 'nav.instances' },
  { to: '/social', icon: 'i-lucide-users', label: 'nav.social' },
  { to: '/servers', icon: 'i-lucide-server', label: 'nav.servers' },
  { to: '/worlds', icon: 'i-lucide-globe', label: 'nav.worlds' },
  { to: '/screenshots', icon: 'i-lucide-camera', label: 'nav.screenshots' },
  { to: '/skins', icon: 'i-lucide-user-round', label: 'nav.skins' },
  { to: '/settings', icon: 'i-lucide-sliders-vertical', label: 'nav.settings' },
]

const groups = computed<CommandPaletteGroup<CommandPaletteItem>[]>(() => [
  {
    id: 'instances',
    label: t('swiftx.palette.instances'),
    items: instances.instances.map(i => ({
      label: t('swiftx.palette.play', { name: i.name }),
      suffix: i.mc_version,
      icon: 'i-lucide-play',
      onSelect: run(() => launchFlow.play(i.id)),
    })),
  },
  {
    id: 'actions',
    label: t('swiftx.palette.actions'),
    items: [
      { label: t('nav.newInstance'), icon: 'i-lucide-plus', onSelect: run(() => createModal.open()) },
      { label: t('swiftx.palette.card'), icon: 'i-lucide-trophy', onSelect: run(() => { cardOpen.value = true }) },
      { label: t('account.signIn'), icon: 'i-lucide-log-in', onSelect: run(() => router.push({ path: '/settings', query: { section: 'accounts' } })) },
    ],
  },
  {
    id: 'nav',
    label: t('swiftx.palette.nav'),
    items: pages.map(p => ({ label: t(p.label), icon: p.icon, onSelect: run(() => router.push(p.to)) })),
  },
])
</script>
