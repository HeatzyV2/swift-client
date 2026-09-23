<template>
  <div class="flex h-full">
    <nav class="flex w-[220px] shrink-0 flex-col gap-0.5 border-r border-default px-3 py-7">
      <h1 class="mb-4 px-3 font-display text-[22px] font-semibold text-highlighted">{{ t('settings.title') }}</h1>
      <button
        v-for="s in sections"
        :key="s.key"
        type="button"
        class="flex h-9 items-center gap-3 rounded-md px-3 text-left text-[13px] font-medium transition-colors"
        :class="section === s.key ? 'bg-[var(--sw-surface-2)] text-highlighted' : 'text-muted hover:bg-white/[0.03] hover:text-toned'"
        @click="section = s.key"
      >
        <UIcon :name="s.icon" class="size-4" :class="section === s.key ? 'text-primary' : 'text-dimmed'" />
        {{ t(`settings.sections.${s.key}`) }}
      </button>
    </nav>

    <div class="min-w-0 flex-1 overflow-y-auto">
      <div class="mx-auto max-w-3xl px-10 py-8">
        <h2 class="mb-2 font-display text-lg font-semibold text-highlighted">{{ t(`settings.sections.${section}`) }}</h2>

        <div v-if="!settings && needsSettings" class="space-y-4 py-6">
          <div v-for="n in 4" :key="n" class="sw-skeleton h-10" />
        </div>

        <!-- General -->
        <template v-else-if="section === 'general'">
          <SettingsGroup>
            <SettingsRow :label="t('settings.language.label')" :description="t('settings.language.auto')">
              <USelect :model-value="locale" :items="localeItems" value-key="value" class="w-48" @update:model-value="onLocaleChange" />
            </SettingsRow>
            <SettingsRow :label="t('settings.appearance.theme')" :description="t('settings.appearance.themeDesc')">
              <div class="flex gap-1 rounded-md border border-default bg-[var(--sw-surface)] p-0.5">
                <button
                  v-for="opt in themeOptions"
                  :key="opt.value"
                  type="button"
                  class="flex h-7 items-center gap-2 rounded px-3 text-xs font-medium transition-colors"
                  :class="theme.mode === opt.value ? 'bg-[var(--sw-surface-3)] text-highlighted' : 'text-muted hover:text-toned'"
                  @click="theme.setMode(opt.value)"
                >
                  <span class="size-2.5 rounded-full border border-white/20" :style="{ background: opt.swatch }" />
                  {{ opt.label }}
                </button>
              </div>
            </SettingsRow>
          </SettingsGroup>
        </template>

        <!-- Accounts -->
        <template v-else-if="section === 'accounts'">
          <SettingsGroup>
            <div class="py-4">
              <p v-if="!accounts.accounts.length" class="sw-panel px-4 py-6 text-center text-sm text-muted">{{ t('settings.accounts.noAccounts') }}</p>
              <ul v-else class="sw-panel divide-y divide-[var(--sw-line-soft)]">
                <li v-for="acc in accounts.accounts" :key="acc.uuid" class="flex items-center gap-3 px-4 py-3">
                  <AccountAvatar :account="acc" class="size-9" />
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-[13px] font-medium text-highlighted">{{ acc.username }}</p>
                    <p class="text-xs text-dimmed">{{ t(`account.kind.${acc.kind}`) }}</p>
                  </div>
                  <UBadge v-if="acc.uuid === accounts.activeUuid" color="primary" variant="subtle" :label="t('settings.accounts.active')" />
                  <UButton v-else size="xs" color="neutral" variant="soft" :label="t('settings.accounts.setActive')" @click="accounts.setActive(acc.uuid)" />
                  <UButton icon="i-lucide-trash-2" size="xs" color="neutral" variant="ghost" :aria-label="t('common.remove')" @click="accounts.remove(acc.uuid)" />
                </li>
              </ul>
            </div>
            <SettingsRow :label="t('account.microsoftTitle')" :description="t('account.microsoftDesc')">
              <UButton icon="i-lucide-log-in" :label="t('settings.accounts.microsoft')" :loading="accounts.loading" @click="onMicrosoftLogin" />
            </SettingsRow>
            <SettingsRow :label="t('settings.accounts.offline')" :description="t('settings.accounts.offlineHint')" stacked>
              <form class="flex gap-2" @submit.prevent="onOfflineLogin">
                <UInput v-model="offlineName" :placeholder="t('settings.accounts.offlineUsername')" class="flex-1" />
                <UButton type="submit" color="neutral" variant="soft" icon="i-lucide-user-plus" :label="t('common.add')" :disabled="offlineName.trim().length < 3" />
              </form>
            </SettingsRow>
            <p v-if="accounts.error" class="py-2 text-xs text-error">{{ accounts.error }}</p>
          </SettingsGroup>
        </template>

        <!-- Minecraft -->
        <template v-else-if="section === 'minecraft' && settings">
          <SettingsGroup :title="t('settings.minecraft.memoryTitle')">
            <SettingsRow :label="t('settings.defaults.memory')" :description="t('settings.defaults.memoryDesc')" stacked>
              <div class="flex items-center gap-4">
                <USlider v-model="settings.default_memory_mb" :min="sysMem.minMb" :max="sysMem.maxMb.value" :step="256" class="flex-1" />
                <span class="w-20 shrink-0 text-right font-mono text-sm text-highlighted">{{ (settings.default_memory_mb / 1024).toFixed(1) }} GB</span>
              </div>
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup :title="t('settings.minecraft.windowTitle')">
            <SettingsRow :label="t('instSettings.fullscreen')" :description="t('instSettings.fullscreenDesc')">
              <USwitch v-model="settings.default_fullscreen" />
            </SettingsRow>
            <SettingsRow :label="t('settings.minecraft.resolution')" :description="t('settings.minecraft.resolutionDesc')">
              <div class="flex items-center gap-2">
                <UInput v-model.number="settings.default_width" type="number" placeholder="854" class="w-24" :disabled="settings.default_fullscreen" />
                <span class="text-dimmed">×</span>
                <UInput v-model.number="settings.default_height" type="number" placeholder="480" class="w-24" :disabled="settings.default_fullscreen" />
              </div>
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup :title="t('settings.java.title')">
            <SettingsRow :label="t('settings.java.detected')" :description="t('settings.java.detectedDesc')">
              <UButton icon="i-lucide-radar" size="sm" color="neutral" variant="soft" :loading="java.scanning.value" :label="t('settings.java.autoDetect')" @click="java.scan()" />
            </SettingsRow>
            <div class="py-3">
              <p v-if="!java.installations.value.length && !java.scanning.value" class="sw-panel px-4 py-5 text-center text-sm text-muted">
                {{ t('settings.java.noJava') }}
              </p>
              <ul v-else class="sw-panel divide-y divide-[var(--sw-line-soft)]">
                <li v-for="inst in java.installations.value" :key="inst.path" class="flex items-center gap-3 px-4 py-2.5">
                  <UIcon name="i-lucide-coffee" class="size-4 shrink-0 text-dimmed" />
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 text-[13px]">
                      <span class="font-medium text-highlighted">Java {{ inst.major ?? '?' }}</span>
                      <span class="font-mono text-[11px] text-dimmed">{{ inst.version }}</span>
                      <span v-if="inst.vendor" class="text-[11px] text-dimmed">· {{ inst.vendor }}</span>
                    </div>
                    <div class="truncate font-mono text-[11px] text-dimmed" :title="inst.path">{{ inst.path }}</div>
                  </div>
                  <UBadge v-if="settings.default_java_path === inst.path" color="primary" variant="subtle" size="sm" :label="t('settings.java.isDefault')" />
                  <UButton v-else size="xs" color="neutral" variant="ghost" :label="t('settings.java.setDefault')" @click="settings.default_java_path = inst.path" />
                </li>
              </ul>
            </div>
            <SettingsRow :label="t('settings.java.defaultPath')" :description="t('settings.java.defaultPathHint')" stacked>
              <div class="flex gap-2">
                <UInput v-model="settings.default_java_path" :placeholder="t('settings.java.managed')" class="flex-1 font-mono text-xs" />
                <UButton icon="i-lucide-folder" color="neutral" variant="soft" square :aria-label="t('settings.java.browse')" @click="browseDefaultJava" />
                <UButton v-if="settings.default_java_path" icon="i-lucide-x" color="neutral" variant="ghost" square :aria-label="t('common.remove')" @click="settings.default_java_path = undefined" />
              </div>
            </SettingsRow>
          </SettingsGroup>
        </template>

        <!-- Sync -->
        <template v-else-if="section === 'sync'">
          <SyncSettings />
        </template>

        <!-- Privacy -->
        <template v-else-if="section === 'privacy' && settings">
          <SettingsGroup>
            <SettingsRow :label="t('settings.privacy.track_playtime')" :description="t('settings.privacy.track_playtimeDesc')">
              <USwitch v-model="settings.track_playtime" />
            </SettingsRow>
            <SettingsRow :label="t('settings.privacy.discord_rpc')" :description="t('settings.privacy.discord_rpcDesc')">
              <USwitch v-model="settings.discord_rpc" />
            </SettingsRow>
          </SettingsGroup>
          <p class="flex items-start gap-2 text-xs text-muted">
            <UIcon name="i-lucide-shield-check" class="mt-px size-4 shrink-0 text-primary" />
            {{ t('settings.privacy.noTelemetry') }}
          </p>
        </template>

        <!-- Advanced -->
        <template v-else-if="section === 'advanced' && settings">
          <SettingsGroup :title="t('settings.advanced.launchTitle')">
            <SettingsRow :label="t('instSettings.customJavaArgs')" :description="t('instSettings.customJavaArgsDesc')" stacked>
              <UTextarea v-model="defJavaArgs" :rows="2" placeholder="-XX:+UseG1GC" class="w-full font-mono text-xs" />
            </SettingsRow>
            <SettingsRow :label="t('instSettings.customEnv')" :description="t('instSettings.customEnvDesc')" stacked>
              <div class="space-y-2">
                <div v-for="(e, i) in settings.default_env_vars" :key="i" class="flex gap-2">
                  <UInput v-model="e.key" placeholder="KEY" class="flex-1 font-mono text-xs" />
                  <UInput v-model="e.value" placeholder="value" class="flex-1 font-mono text-xs" />
                  <UButton icon="i-lucide-x" color="neutral" variant="ghost" square :aria-label="t('common.remove')" @click="settings.default_env_vars.splice(i, 1)" />
                </div>
                <UButton icon="i-lucide-plus" size="xs" color="neutral" variant="soft" :label="t('instSettings.addEnv')" @click="settings.default_env_vars.push({ key: '', value: '' })" />
              </div>
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup :title="t('settings.advanced.hooksTitle')">
            <SettingsRow :label="t('instSettings.preLaunch')" :description="t('instSettings.preLaunchHint')" stacked>
              <UInput v-model="settings.default_pre_launch" class="w-full font-mono text-xs" />
            </SettingsRow>
            <SettingsRow :label="t('instSettings.wrapper')" :description="t('instSettings.wrapperHint')" stacked>
              <UInput v-model="settings.default_wrapper" class="w-full font-mono text-xs" />
            </SettingsRow>
            <SettingsRow :label="t('instSettings.postExit')" :description="t('instSettings.postExitHint')" stacked>
              <UInput v-model="settings.default_post_exit" class="w-full font-mono text-xs" />
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup :title="t('settings.advanced.filesTitle')">
            <SettingsRow v-for="folder in folders" :key="folder.key" :label="t(`settings.advanced.folders.${folder.key}`)" :description="folder.path">
              <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-folder-open" :label="t('settings.advanced.show')" :disabled="!folder.path" @click="reveal(folder.path)" />
            </SettingsRow>
          </SettingsGroup>
        </template>

        <!-- About -->
        <template v-else-if="section === 'about'">
          <div class="sw-panel mt-4 flex items-center gap-4 p-5">
            <div class="flex size-14 items-center justify-center rounded-xl border border-default bg-[var(--sw-canvas)]">
              <BrandMark class="size-8 text-primary" />
            </div>
            <div>
              <p class="font-display text-lg font-semibold text-highlighted">{{ BRAND.name }}</p>
              <p class="font-mono text-xs text-muted">v{{ version }}</p>
            </div>
          </div>

          <SettingsGroup class="mt-4">
            <SettingsRow :label="t('settings.about.updates')" :description="t('settings.about.updatesDesc')">
              <UBadge color="neutral" variant="subtle" :label="t('settings.about.manual')" />
            </SettingsRow>
            <SettingsRow :label="t('settings.about.online')" :description="backend.configured.value ? t('settings.about.onlineOn') : t('settings.about.onlineOff')">
              <UBadge :color="backend.configured.value ? 'success' : 'neutral'" variant="subtle" :label="backend.configured.value ? t('settings.about.connected') : t('settings.about.offline')" />
            </SettingsRow>
            <SettingsRow :label="t('settings.about.license')" :description="t('settings.about.licenseDesc', { upstream: BRAND.upstream.name, author: BRAND.upstream.author })">
              <UButton size="xs" color="neutral" variant="ghost" trailing-icon="i-lucide-arrow-up-right" :label="t('settings.about.source')" @click="openExternal(BRAND.upstream.url)" />
            </SettingsRow>
          </SettingsGroup>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import { getVersion } from '@tauri-apps/api/app'
import { open } from '@tauri-apps/plugin-dialog'
import type { ThemeMode } from '~/stores/useThemeStore'
import type { LauncherPaths, Settings } from '~/types/launcher'

const { t, locale, locales, setLocale } = useI18n()
const route = useRoute()
const theme = useThemeStore()
const accounts = useAccountStore()
const java = useJava()
const sysMem = useSystemMemory()
const backend = useBackend()
const toast = useToast()

type Section = 'general' | 'accounts' | 'minecraft' | 'sync' | 'privacy' | 'advanced' | 'about'
const sections: { key: Section, icon: string }[] = [
  { key: 'general', icon: 'i-lucide-sliders-horizontal' },
  { key: 'accounts', icon: 'i-lucide-users' },
  { key: 'minecraft', icon: 'i-lucide-box' },
  { key: 'sync', icon: 'i-lucide-refresh-cw' },
  { key: 'privacy', icon: 'i-lucide-shield' },
  { key: 'advanced', icon: 'i-lucide-terminal' },
  { key: 'about', icon: 'i-lucide-info' },
]
const initial = route.query.section as Section | undefined
const section = ref<Section>(initial && sections.some(s => s.key === initial) ? initial : 'general')
const needsSettings = computed(() => ['minecraft', 'privacy', 'advanced'].includes(section.value))

const offlineName = ref('')
const settings = ref<Settings | null>(null)
const version = ref('')
const paths = ref<LauncherPaths | null>(null)

onMounted(async () => {
  accounts.ensureLoaded()
  sysMem.ensure()
  getVersion().then((v) => { version.value = v })
  invoke<LauncherPaths>('get_launcher_paths').then((p) => { paths.value = p }).catch(() => {})
  try {
    settings.value = await invoke<Settings>('get_settings')
  } catch (e) {
    toast.add({ title: errorText(e), color: 'error' })
  }
})

watch(section, (s) => {
  if (s === 'minecraft' && !java.installations.value.length && !java.scanning.value) java.scan()
}, { immediate: true })

const defJavaArgs = computed({
  get: () => settings.value?.default_java_args.join(' ') ?? '',
  set: (v: string) => { if (settings.value) settings.value.default_java_args = v.split(/\s+/).filter(Boolean) },
})

async function browseDefaultJava() {
  const p = await open({ multiple: false, directory: false })
  if (typeof p === 'string' && settings.value) settings.value.default_java_path = p
}

let saveTimer: ReturnType<typeof setTimeout> | undefined
watch(settings, (value, previous) => {
  if (!value || !previous) return
  clearTimeout(saveTimer)
  const snapshot = JSON.parse(JSON.stringify(value)) as Settings
  saveTimer = setTimeout(() => {
    invoke('save_settings', { settings: snapshot }).catch(e => toast.add({ title: errorText(e), color: 'error' }))
  }, 400)
}, { deep: true })

const themeOptions = computed<{ value: ThemeMode, label: string, swatch: string }[]>(() => [
  { value: 'dark', label: t('settings.appearance.themeDark'), swatch: '#0d0e11' },
  { value: 'oled', label: t('settings.appearance.themeOled'), swatch: '#000000' },
])

const localeItems = computed(() =>
  (locales.value as { code: string, name?: string }[]).map(l => ({ label: l.name ?? l.code, value: l.code })),
)
const onLocaleChange = (code: string) => setLocale(code as 'en' | 'pl' | 'de' | 'es' | 'fr' | 'zh' | 'ru')

const folders = computed(() => [
  { key: 'data', path: paths.value?.data_root ?? '' },
  { key: 'instances', path: paths.value?.instances ?? '' },
  { key: 'logs', path: paths.value?.logs ?? '' },
])

async function reveal(path: string) {
  try {
    await invoke('reveal_in_explorer', { path })
  } catch (e) {
    toast.add({ title: errorText(e), color: 'error' })
  }
}

async function onMicrosoftLogin() {
  try {
    await accounts.login()
  } catch { /* shown through accounts.error */ }
}

async function onOfflineLogin() {
  const name = offlineName.value.trim()
  if (name.length < 3) return
  try {
    await accounts.loginOffline(name)
    offlineName.value = ''
  } catch { /* shown through accounts.error */ }
}
</script>
