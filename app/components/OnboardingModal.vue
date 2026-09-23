<template>
  <UModal v-model:open="open" :dismissible="false" :ui="{ content: 'max-w-lg overflow-hidden' }">
    <template #content>
      <div class="flex flex-col">
        <div class="flex h-1 w-full bg-white/5">
          <div class="h-full bg-primary transition-[width] duration-200" :style="{ width: `${((step + 1) / STEPS) * 100}%` }" />
        </div>

        <div class="min-h-[320px] px-8 py-8">
          <Transition name="sw-fade" mode="out-in">
            <div v-if="step === 0" key="welcome" class="flex flex-col items-center gap-5 pt-6 text-center">
              <div class="flex size-16 items-center justify-center rounded-2xl border border-default bg-[var(--sw-canvas)]">
                <BrandMark class="size-9 text-primary" />
              </div>
              <div>
                <h2 class="font-display text-2xl font-semibold text-highlighted">{{ $t('onboarding.welcomeTitle') }}</h2>
                <p class="mt-2 text-sm text-muted">{{ $t('onboarding.welcomeText') }}</p>
              </div>
            </div>

            <div v-else-if="step === 1" key="account" class="space-y-5">
              <div>
                <h2 class="font-display text-lg font-semibold text-highlighted">{{ $t('onboarding.accountTitle') }}</h2>
                <p class="mt-1 text-sm text-muted">{{ $t('onboarding.accountText') }}</p>
              </div>
              <div v-if="accounts.activeAccount" class="sw-panel flex items-center gap-3 p-3 text-sm">
                <AccountAvatar :account="accounts.activeAccount" class="size-8" />
                <span class="flex-1 text-highlighted">{{ $t('onboarding.signedInAs', { name: accounts.activeAccount.username }) }}</span>
                <UIcon name="i-lucide-circle-check" class="size-4 text-[var(--sw-success)]" />
              </div>
              <template v-else>
                <UButton block size="lg" icon="i-lucide-log-in" :loading="loggingIn" :label="$t('settings.accounts.microsoft')" @click="msLogin" />
                <div class="flex items-center gap-3 text-xs text-dimmed">
                  <div class="h-px flex-1 bg-[var(--sw-line)]" />{{ $t('onboarding.or') }}<div class="h-px flex-1 bg-[var(--sw-line)]" />
                </div>
                <form class="flex gap-2" @submit.prevent="offlineLogin">
                  <UInput v-model="offlineName" :placeholder="$t('settings.accounts.offlineUsername')" class="flex-1" />
                  <UButton type="submit" color="neutral" variant="soft" :disabled="offlineName.trim().length < 3" :label="$t('settings.accounts.offline')" />
                </form>
                <p class="text-xs text-dimmed">{{ $t('settings.accounts.offlineHint') }}</p>
              </template>
            </div>

            <div v-else-if="step === 2" key="java" class="space-y-5">
              <div>
                <h2 class="font-display text-lg font-semibold text-highlighted">{{ $t('onboarding.javaTitle') }}</h2>
                <p class="mt-1 text-sm text-muted">{{ $t('onboarding.javaText') }}</p>
              </div>
              <div class="sw-panel flex items-center justify-between p-3 text-sm">
                <span class="flex items-center gap-2 text-toned">
                  <UIcon name="i-lucide-coffee" class="size-4 text-dimmed" />
                  {{ java.scanning.value ? $t('settings.java.scanning') : $t('onboarding.javaFound', { n: java.installations.value.length }) }}
                </span>
                <UButton size="xs" color="neutral" variant="soft" :loading="java.scanning.value" :label="$t('settings.java.autoDetect')" @click="java.scan()" />
              </div>
              <div>
                <div class="mb-2 flex items-center justify-between text-sm">
                  <span class="font-medium text-highlighted">{{ $t('onboarding.ram') }}</span>
                  <span class="font-mono text-primary">{{ (ram / 1024).toFixed(1) }} GB</span>
                </div>
                <USlider v-model="ram" :min="sysMem.minMb" :max="sysMem.maxMb.value" :step="256" />
              </div>
            </div>

            <div v-else-if="step === 3" key="privacy" class="space-y-4">
              <div>
                <h2 class="font-display text-lg font-semibold text-highlighted">{{ $t('onboarding.privacyTitle') }}</h2>
                <p class="mt-1 text-sm text-muted">{{ $t('onboarding.privacyText') }}</p>
              </div>
              <div v-if="settings" class="sw-panel divide-y divide-[var(--sw-line-soft)] px-4">
                <SettingsRow :label="$t('settings.privacy.track_playtime')" :description="$t('settings.privacy.track_playtimeDesc')">
                  <USwitch v-model="settings.track_playtime" />
                </SettingsRow>
                <SettingsRow :label="$t('settings.privacy.discord_rpc')" :description="$t('settings.privacy.discord_rpcDesc')">
                  <USwitch v-model="settings.discord_rpc" />
                </SettingsRow>
              </div>
              <p class="flex items-start gap-2 text-xs text-muted">
                <UIcon name="i-lucide-shield-check" class="mt-px size-4 shrink-0 text-primary" />
                {{ $t('settings.privacy.noTelemetry') }}
              </p>
            </div>

            <div v-else key="done" class="flex flex-col items-center gap-4 pt-8 text-center">
              <div class="flex size-12 items-center justify-center rounded-full bg-primary/12">
                <UIcon name="i-lucide-check" class="size-6 text-primary" />
              </div>
              <div>
                <h2 class="font-display text-xl font-semibold text-highlighted">{{ $t('onboarding.doneTitle') }}</h2>
                <p class="mt-2 text-sm text-muted">{{ $t('onboarding.doneText') }}</p>
              </div>
            </div>
          </Transition>
        </div>

        <div class="flex items-center justify-between border-t border-default px-6 py-3">
          <UButton v-if="step > 0 && step < STEPS - 1" variant="ghost" color="neutral" :label="$t('create.back')" @click="step--" />
          <UButton v-else variant="ghost" color="neutral" :label="$t('onboarding.skip')" @click="finish" />
          <UButton v-if="step < STEPS - 1" :label="$t('onboarding.next')" trailing-icon="i-lucide-arrow-right" @click="step++" />
          <UButton v-else icon="i-lucide-check" :label="$t('onboarding.start')" @click="complete" />
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import type { Settings } from '~/types/launcher'

const STEPS = 5

const { open, isDone, finish } = useOnboarding()
const accounts = useAccountStore()
const java = useJava()
const sysMem = useSystemMemory()
const toast = useToast()

const step = ref(0)
const offlineName = ref('')
const loggingIn = ref(false)
const ram = ref(4096)
const settings = ref<Settings | null>(null)

onMounted(async () => {
  if (!isDone()) open.value = true
  await accounts.ensureLoaded()
  await sysMem.ensure()
  try {
    settings.value = await invoke<Settings>('get_settings')
    ram.value = settings.value.default_memory_mb || 4096
  } catch { /* defaults stay */ }
})

watch(open, (v) => {
  if (v) {
    step.value = 0
    if (!java.installations.value.length) java.scan()
  }
}, { immediate: true })

async function msLogin() {
  loggingIn.value = true
  try { await accounts.login() }
  catch (e) { toast.add({ title: errorText(e), color: 'error' }) }
  finally { loggingIn.value = false }
}

async function offlineLogin() {
  const name = offlineName.value.trim()
  if (name.length < 3) return
  try { await accounts.loginOffline(name) }
  catch (e) { toast.add({ title: errorText(e), color: 'error' }) }
}

async function complete() {
  if (settings.value) {
    try {
      await invoke('save_settings', { settings: { ...settings.value, default_memory_mb: ram.value } })
    } catch (e) {
      toast.add({ title: errorText(e), color: 'error' })
    }
  }
  finish()
}
</script>
