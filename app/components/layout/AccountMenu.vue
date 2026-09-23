<template>
  <UDropdownMenu :items="items" :content="{ align: 'end', sideOffset: 8 }" :ui="{ content: 'w-60' }">
    <button
      type="button"
      class="flex h-9 items-center gap-2.5 rounded-lg border border-[var(--sw-line)] bg-[var(--sw-surface)] pl-1 pr-2.5 transition-colors hover:border-[var(--sw-line-strong)] hover:bg-[var(--sw-surface-2)]"
    >
      <AccountAvatar :account="accounts.activeAccount" :face="face" class="size-7" />
      <span class="max-w-36 truncate text-[13px] font-semibold text-highlighted">
        {{ accounts.activeAccount?.username ?? $t('account.signIn') }}
      </span>
      <UIcon name="i-lucide-chevron-down" class="size-3.5 text-dimmed" />
    </button>
  </UDropdownMenu>
</template>

<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const accounts = useAccountStore()
const router = useRouter()
const toast = useToast()
const { t } = useI18n()

onMounted(() => accounts.ensureLoaded())

// Only a real skin gives a face; the fallback skin is not the player's own.
const { skin, isDefault } = usePlayerSkin()
const face = ref<string | null>(null)
watch([skin, isDefault], async ([s, fallback]) => {
  face.value = s && !fallback ? await skinFace(s.src).catch(() => null) : null
}, { immediate: true })

async function signInMicrosoft() {
  try {
    await accounts.login()
    toast.add({ title: t('account.added'), color: 'success', icon: 'i-lucide-check' })
  } catch (e) {
    toast.add({ title: errorText(e), color: 'error' })
  }
}

const items = computed<DropdownMenuItem[][]>(() => [
  accounts.accounts.map(acc => ({
    label: acc.username,
    description: t(`account.kind.${acc.kind}`),
    icon: acc.uuid === accounts.activeUuid ? 'i-lucide-circle-check' : 'i-lucide-circle',
    onSelect: () => accounts.setActive(acc.uuid),
  })),
  [
    { label: t('settings.accounts.microsoft'), icon: 'i-lucide-log-in', onSelect: signInMicrosoft },
    { label: t('account.manage'), icon: 'i-lucide-users', onSelect: () => router.push({ path: '/settings', query: { section: 'accounts' } }) },
  ],
].filter(group => group.length))
</script>
