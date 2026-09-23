<template>
  <UDropdownMenu :items="items" :content="{ side: 'top', align: 'start' }" :ui="{ content: 'w-56' }">
    <button
      type="button"
      class="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/[0.03]"
    >
      <AccountAvatar :account="accounts.activeAccount" class="size-8" />
      <span class="min-w-0 flex-1">
        <span class="block truncate text-[13px] font-medium text-highlighted">
          {{ accounts.activeAccount?.username ?? $t('account.none') }}
        </span>
        <span class="block truncate text-[11px] text-dimmed">
          {{ accounts.activeAccount ? $t(`account.kind.${accounts.activeAccount.kind}`) : $t('account.signInHint') }}
        </span>
      </span>
      <UIcon name="i-lucide-chevrons-up-down" class="size-4 shrink-0 text-dimmed" />
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
    icon: acc.uuid === accounts.activeUuid ? 'i-lucide-check' : 'i-lucide-user',
    onSelect: () => accounts.setActive(acc.uuid),
  })),
  [
    { label: t('settings.accounts.microsoft'), icon: 'i-lucide-log-in', onSelect: signInMicrosoft },
    { label: t('account.manage'), icon: 'i-lucide-users', onSelect: () => router.push({ path: '/settings', query: { section: 'accounts' } }) },
  ],
].filter(group => group.length))
</script>
