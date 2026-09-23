<template>
  <div class="flex h-full">
    <!-- Categorized settings nav -->
    <nav class="flex w-[232px] shrink-0 flex-col border-r border-default px-3 py-6">
      <div class="mb-5 px-3">
        <h1 class="font-display text-[22px] font-semibold tracking-tight text-highlighted">{{ t('settings.title') }}</h1>
        <p class="mt-0.5 text-xs text-muted">{{ t('settings.subtitle') }}</p>
      </div>

      <div v-for="group in navGroups" :key="group.id" class="mb-4">
        <p class="sw-eyebrow mb-1.5 px-3">{{ t(`settings.nav.${group.id}`) }}</p>
        <button
          v-for="s in group.items"
          :key="s.key"
          type="button"
          class="flex h-9 w-full items-center gap-3 rounded-lg px-3 text-left text-[13px] font-medium transition-colors"
          :class="section === s.key
            ? 'bg-[var(--sw-surface-2)] text-highlighted'
            : 'text-muted hover:bg-white/[0.03] hover:text-toned'"
          @click="section = s.key"
        >
          <UIcon
            :name="s.icon"
            class="size-4"
            :class="section === s.key ? 'text-[var(--sw-accent)]' : 'text-dimmed'"
          />
          {{ t(`settings.sections.${s.key}`) }}
        </button>
      </div>
    </nav>

    <div class="min-w-0 flex-1 overflow-y-auto">
      <div class="mx-auto max-w-3xl px-8 py-8">
        <div class="mb-6">
          <h2 class="font-display text-xl font-semibold text-highlighted">{{ t(`settings.sections.${section}`) }}</h2>
          <p class="mt-1 text-sm text-muted">{{ t(`settings.sectionDesc.${section}`) }}</p>
        </div>

        <div v-if="!settings && needsSettings" class="space-y-4">
          <div v-for="n in 3" :key="n" class="sw-skeleton h-28 rounded-[14px]" />
        </div>

        <!-- Appearance: theme + language -->
        <template v-else-if="section === 'appearance'">
          <section class="sw-settings-card mb-4">
            <h3 class="sw-eyebrow mb-4">{{ t('settings.appearance.theme') }}</h3>
            <div class="flex flex-col gap-5 sm:flex-row">
              <div class="flex min-w-0 flex-1 flex-col gap-1.5">
                <button
                  v-for="opt in themeOptions"
                  :key="opt.value"
                  type="button"
                  class="sw-choice"
                  :class="{ 'is-active': theme.mode === opt.value }"
                  @click="theme.setMode(opt.value)"
                >
                  <span
                    class="h-5 w-1.5 shrink-0 rounded-full"
                    :style="{ background: opt.accent }"
                  />
                  <span class="min-w-0 flex-1 text-[13px] font-medium text-highlighted">{{ opt.label }}</span>
                  <span
                    class="size-3.5 shrink-0 rounded-full border border-white/15"
                    :style="{ background: opt.swatch }"
                  />
                  <UIcon
                    v-if="theme.mode === opt.value"
                    name="i-lucide-check"
                    class="size-4 shrink-0 text-highlighted"
                  />
                </button>
              </div>

              <!-- Live mini preview -->
              <div
                class="relative hidden w-[220px] shrink-0 overflow-hidden rounded-xl border border-[var(--sw-line)] sm:block"
                :style="{ background: previewTokens.canvas }"
              >
                <div class="flex h-[168px]">
                  <div
                    class="flex w-8 flex-col items-center gap-2 border-r py-3"
                    :style="{ background: previewTokens.stage, borderColor: previewTokens.line }"
                  >
                    <span v-for="n in 4" :key="n" class="size-3 rounded" :style="{ background: previewTokens.lineStrong }" />
                    <span class="mt-auto size-3 rounded" :style="{ background: previewTokens.accent }" />
                  </div>
                  <div class="flex min-w-0 flex-1 flex-col p-2.5">
                    <div
                      class="mb-2 h-5 rounded-md"
                      :style="{ background: previewTokens.surface }"
                    />
                    <div
                      class="flex flex-1 overflow-hidden rounded-lg border"
                      :style="{ background: previewTokens.surface, borderColor: previewTokens.line }"
                    >
                      <div class="w-14 border-r p-1.5" :style="{ borderColor: previewTokens.line, background: previewTokens.surface2 }">
                        <div class="mb-1 h-2 rounded" :style="{ background: previewTokens.accent }" />
                        <div v-for="n in 3" :key="n" class="mb-1 h-1.5 rounded" :style="{ background: previewTokens.lineStrong }" />
                      </div>
                      <div class="flex-1 space-y-1.5 p-2">
                        <div class="h-2 w-3/4 rounded" :style="{ background: previewTokens.lineStrong }" />
                        <div class="h-8 rounded-md" :style="{ background: previewTokens.surface3 }" />
                        <div class="h-2 w-1/2 rounded" :style="{ background: previewTokens.line }" />
                      </div>
                    </div>
                  </div>
                </div>
                <p class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent px-3 pb-2.5 pt-6 text-[11px] text-white/70">
                  {{ t('settings.appearance.preview') }}
                </p>
              </div>
            </div>
          </section>

          <section class="sw-settings-card mb-4">
            <h3 class="sw-eyebrow mb-4">{{ t('settings.language.title') }}</h3>
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                v-for="loc in localeChoices"
                :key="loc.code"
                type="button"
                class="sw-choice"
                :class="{ 'is-active': locale === loc.code }"
                @click="onLocaleChange(loc.code)"
              >
                <LocaleFlag :code="loc.code" />
                <span class="min-w-0 flex-1">
                  <span class="block text-[13px] font-medium text-highlighted">{{ loc.native }}</span>
                  <span class="block text-[11px] text-muted">{{ loc.name }}</span>
                </span>
                <UIcon
                  v-if="locale === loc.code"
                  name="i-lucide-check"
                  class="size-4 shrink-0 text-highlighted"
                />
              </button>
            </div>
          </section>
        </template>

        <!-- Accounts -->
        <template v-else-if="section === 'accounts'">
          <SettingsGroup :title="t('settings.accounts.title')">
            <div class="py-1">
              <p v-if="!accounts.accounts.length" class="rounded-xl border border-dashed border-[var(--sw-line)] px-4 py-8 text-center text-sm text-muted">
                {{ t('settings.accounts.noAccounts') }}
              </p>
              <ul v-else class="divide-y divide-[var(--sw-line-soft)] overflow-hidden rounded-xl border border-[var(--sw-line)] bg-[var(--sw-surface-2)]">
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

          <SettingsGroup v-if="backend.configured.value" :title="t('settings.swift.title')">
            <template v-if="backend.session.value">
              <SettingsRow :label="t('settings.swift.signedIn')" :description="backend.session.value.username">
                <div class="flex items-center gap-2">
                  <UBadge
                    v-if="backend.session.value.mc_username"
                    color="success"
                    variant="subtle"
                    :label="backend.session.value.mc_username"
                  />
                  <UButton
                    v-else
                    size="xs"
                    color="neutral"
                    variant="soft"
                    :label="t('settings.swift.linkMinecraft')"
                    :loading="swiftBusy"
                    @click="onSwiftLink"
                  />
                  <UButton size="xs" color="neutral" variant="ghost" :label="t('settings.swift.logout')" @click="onSwiftLogout" />
                </div>
              </SettingsRow>
            </template>
            <template v-else>
              <SettingsRow :label="t('settings.swift.desc')" stacked>
                <form class="space-y-2" @submit.prevent="onSwiftAuth">
                  <UInput v-model="swiftUser" :placeholder="t('settings.swift.username')" class="w-full" autocomplete="username" />
                  <UInput v-model="swiftPass" type="password" :placeholder="t('settings.swift.password')" class="w-full" autocomplete="current-password" />
                  <div class="flex gap-2">
                    <UButton type="submit" :loading="swiftBusy" :label="t('settings.swift.login')" />
                    <UButton type="button" color="neutral" variant="soft" :loading="swiftBusy" :label="t('settings.swift.register')" @click="onSwiftRegister" />
                  </div>
                </form>
              </SettingsRow>
            </template>
            <p v-if="swiftError" class="py-2 text-xs text-error">{{ swiftError }}</p>
          </SettingsGroup>
        </template>

        <!-- Minecraft / game -->
        <template v-else-if="section === 'minecraft' && settings">
          <!-- Memory hero card -->
          <section class="sw-settings-card mb-4">
            <h3 class="sw-eyebrow mb-3">{{ t('settings.minecraft.memoryTitle') }}</h3>
            <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
              <p class="font-display text-3xl font-semibold tracking-tight text-highlighted">
                {{ memoryGb.toFixed(1) }} <span class="text-lg font-medium text-muted">GB</span>
              </p>
              <p v-if="sysMem.totalMb.value" class="text-xs text-muted">
                {{ t('settings.minecraft.memoryUsage', { total: (sysMem.totalMb.value / 1024).toFixed(0) }) }}
              </p>
            </div>
            <USlider
              v-model="settings.default_memory_mb"
              :min="sysMem.minMb"
              :max="sysMem.maxMb.value"
              :step="256"
              class="mb-2"
            />
            <div class="mb-3 flex justify-between text-[11px] text-dimmed">
              <span>{{ (sysMem.minMb / 1024).toFixed(0) }} GB</span>
              <span>{{ (sysMem.maxMb.value / 1024).toFixed(0) }} GB</span>
            </div>
            <p
              v-if="memoryWarn"
              class="mb-2 flex items-start gap-2 text-xs text-[var(--sw-warning)]"
            >
              <UIcon name="i-lucide-triangle-alert" class="mt-px size-3.5 shrink-0" />
              {{ t('settings.minecraft.memoryWarn') }}
            </p>
            <p class="text-xs text-muted">{{ t('settings.minecraft.memoryHint') }}</p>
          </section>

          <SettingsGroup :title="t('settings.minecraft.windowTitle')">
            <SettingsRow :label="t('instSettings.displayMode')" :description="t('instSettings.displayModeDesc')">
              <USelect
                v-model="displayMode"
                :items="displayModeItems"
                value-key="value"
                class="w-56"
              />
            </SettingsRow>
            <p v-if="displayMode === 'borderless'" class="mb-3 -mt-1 px-1 text-xs text-muted">
              {{ t('instSettings.displayBorderlessHint') }}
            </p>
            <SettingsRow :label="t('settings.minecraft.resolution')" :description="t('settings.minecraft.resolutionDesc')">
              <div class="flex items-center gap-2">
                <UInput v-model.number="settings.default_width" type="number" placeholder="854" class="w-24" :disabled="displayMode === 'fullscreen'" />
                <span class="text-dimmed">×</span>
                <UInput v-model.number="settings.default_height" type="number" placeholder="480" class="w-24" :disabled="displayMode === 'fullscreen'" />
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-rotate-ccw"
                  :label="t('settings.minecraft.resetResolution')"
                  :disabled="displayMode === 'fullscreen'"
                  @click="resetResolution"
                />
              </div>
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup :title="t('settings.java.title')">
            <SettingsRow :label="t('settings.java.defaultPath')" :description="t('settings.java.defaultPathHint')" stacked>
              <div class="flex gap-2">
                <UInput v-model="settings.default_java_path" :placeholder="t('settings.java.managed')" class="flex-1 font-mono text-xs" />
                <UButton icon="i-lucide-folder" color="neutral" variant="soft" square :aria-label="t('settings.java.browse')" @click="browseDefaultJava" />
                <UButton v-if="settings.default_java_path" icon="i-lucide-x" color="neutral" variant="ghost" square :aria-label="t('common.remove')" @click="settings.default_java_path = undefined" />
              </div>
            </SettingsRow>
            <SettingsRow :label="t('settings.java.detected')" :description="t('settings.java.detectedDesc')">
              <UButton icon="i-lucide-radar" size="sm" color="neutral" variant="outline" :loading="java.scanning.value" :label="t('settings.java.autoDetect')" @click="java.scan()" />
            </SettingsRow>
            <div class="pb-1 pt-2">
              <p v-if="!java.installations.value.length && !java.scanning.value" class="rounded-xl border border-dashed border-[var(--sw-line)] px-4 py-5 text-center text-sm text-muted">
                {{ t('settings.java.noJava') }}
              </p>
              <ul v-else class="divide-y divide-[var(--sw-line-soft)] overflow-hidden rounded-xl border border-[var(--sw-line)] bg-[var(--sw-surface-2)]">
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
          </SettingsGroup>
        </template>

        <!-- Sync -->
        <template v-else-if="section === 'sync'">
          <div class="sw-settings-card">
            <SyncSettings />
          </div>
        </template>

        <!-- Privacy / options -->
        <template v-else-if="section === 'privacy' && settings">
          <SettingsGroup :title="t('settings.privacy.title')">
            <SettingsRow :label="t('settings.privacy.track_playtime')" :description="t('settings.privacy.track_playtimeDesc')">
              <USwitch v-model="settings.track_playtime" />
            </SettingsRow>
            <SettingsRow :label="t('settings.privacy.discord_rpc')" :description="t('settings.privacy.discord_rpcDesc')">
              <USwitch v-model="settings.discord_rpc" />
            </SettingsRow>
          </SettingsGroup>
          <p class="flex items-start gap-2.5 px-1 text-xs leading-relaxed text-muted">
            <UIcon name="i-lucide-shield-check" class="mt-px size-4 shrink-0 text-[var(--sw-accent)]" />
            {{ t('settings.privacy.noTelemetry') }}
          </p>
        </template>

        <!-- Advanced -->
        <template v-else-if="section === 'advanced' && settings">
          <SettingsGroup :title="t('settings.advanced.filesTitle')">
            <SettingsRow v-for="folder in folders" :key="folder.key" :label="t(`settings.advanced.folders.${folder.key}`)" :description="folder.path || '—'" stacked>
              <UButton
                size="sm"
                color="neutral"
                variant="outline"
                icon="i-lucide-folder-open"
                :label="t('settings.advanced.openFolder')"
                :disabled="!folder.path"
                @click="reveal(folder.path)"
              />
            </SettingsRow>
          </SettingsGroup>

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
        </template>

        <!-- About / updates -->
        <template v-else-if="section === 'about'">
          <div class="sw-settings-card mb-4 flex items-center gap-4">
            <div class="flex size-14 items-center justify-center rounded-2xl border border-[var(--sw-line)] bg-[var(--sw-canvas)]">
              <BrandMark class="size-8 text-[var(--sw-accent)]" />
            </div>
            <div>
              <p class="font-display text-lg font-semibold text-highlighted">{{ BRAND.name }}</p>
              <p class="font-mono text-xs text-muted">v{{ version }}</p>
            </div>
          </div>

          <section class="sw-settings-card mb-4">
            <div class="flex items-center gap-3">
              <div class="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--sw-accent-soft)]">
                <UIcon :name="updateIcon" class="size-5 text-[var(--sw-accent)]" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-[13px] font-medium text-highlighted">{{ updateTitle }}</p>
                <p class="text-xs text-muted">{{ updateDesc }}</p>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <UButton
                  v-if="updateAvailable"
                  size="sm"
                  color="primary"
                  variant="soft"
                  :loading="updateBusy"
                  :label="t('settings.about.install')"
                  @click="installUpdate"
                />
                <UButton
                  size="sm"
                  color="neutral"
                  variant="outline"
                  :loading="updateBusy"
                  :label="t('settings.about.check')"
                  @click="checkUpdate"
                />
              </div>
            </div>
          </section>

          <SettingsGroup>
            <SettingsRow :label="t('settings.about.online')" :description="backend.configured.value ? t('settings.about.onlineOn') : t('settings.about.onlineOff')">
              <UBadge :color="backend.configured.value ? 'success' : 'neutral'" variant="subtle" :label="backend.configured.value ? t('settings.about.connected') : t('settings.about.offline')" />
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
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import type { ThemeMode } from '~/stores/useThemeStore'
import type { DisplayMode, LauncherPaths, Settings } from '~/types/launcher'

const { t, locale, setLocale } = useI18n()
const route = useRoute()
const theme = useThemeStore()
const accounts = useAccountStore()
const java = useJava()
const sysMem = useSystemMemory()
const backend = useBackend()
const toast = useToast()

type Section = 'appearance' | 'accounts' | 'minecraft' | 'sync' | 'privacy' | 'advanced' | 'about'

const navGroups: { id: string, items: { key: Section, icon: string }[] }[] = [
  {
    id: 'display',
    items: [{ key: 'appearance', icon: 'i-lucide-palette' }],
  },
  {
    id: 'game',
    items: [{ key: 'minecraft', icon: 'i-lucide-box' }],
  },
  {
    id: 'launcher',
    items: [
      { key: 'accounts', icon: 'i-lucide-users' },
      { key: 'sync', icon: 'i-lucide-refresh-cw' },
      { key: 'privacy', icon: 'i-lucide-sliders-horizontal' },
      { key: 'advanced', icon: 'i-lucide-folder' },
      { key: 'about', icon: 'i-lucide-info' },
    ],
  },
]

const allSections = navGroups.flatMap(g => g.items)
const initial = route.query.section as string | undefined
/** Map legacy `general` deep-links to the new appearance section. */
const resolvedInitial: Section | undefined
  = initial === 'general'
    ? 'appearance'
    : (allSections.some(s => s.key === initial) ? initial as Section : undefined)
const section = ref<Section>(resolvedInitial ?? 'appearance')
const needsSettings = computed(() => ['minecraft', 'privacy', 'advanced'].includes(section.value))

const offlineName = ref('')
const settings = ref<Settings | null>(null)
const version = ref('')
const paths = ref<LauncherPaths | null>(null)
const swiftUser = ref('')
const swiftPass = ref('')
const swiftBusy = ref(false)
const swiftError = ref<string | null>(null)

const updateBusy = ref(false)
const updateAvailable = ref(false)
const updateVersion = ref('')
const updateError = ref<string | null>(null)
let pendingUpdate: Awaited<ReturnType<typeof check>> | null = null

const updateIcon = computed(() => {
  if (updateError.value) return 'i-lucide-circle-alert'
  if (updateAvailable.value) return 'i-lucide-download'
  return 'i-lucide-circle-check'
})
const updateTitle = computed(() => {
  if (updateAvailable.value && updateVersion.value) {
    return t('settings.about.updateAvailable', { version: updateVersion.value })
  }
  if (updateError.value) return t('settings.about.noEndpoint')
  return t('settings.about.upToDate')
})
const updateDesc = computed(() => updateError.value ?? t('settings.about.updatesDesc'))

async function checkUpdate() {
  updateBusy.value = true
  updateError.value = null
  try {
    const update = await check()
    pendingUpdate = update
    if (update) {
      updateAvailable.value = true
      updateVersion.value = update.version
    } else {
      updateAvailable.value = false
      updateVersion.value = ''
      toast.add({ title: t('settings.about.upToDate'), color: 'success', icon: 'i-lucide-circle-check' })
    }
  } catch (e) {
    updateAvailable.value = false
    updateError.value = t('settings.about.noEndpoint')
    toast.add({ title: t('settings.about.noEndpoint'), description: errorText(e), color: 'neutral' })
  } finally {
    updateBusy.value = false
  }
}

async function installUpdate() {
  if (!pendingUpdate) return
  updateBusy.value = true
  try {
    await pendingUpdate.downloadAndInstall()
    await relaunch()
  } catch (e) {
    toast.add({ title: errorText(e), color: 'error' })
  } finally {
    updateBusy.value = false
  }
}

onMounted(async () => {
  accounts.ensureLoaded()
  backend.refresh()
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

const displayModeItems = computed(() => [
  { label: t('instSettings.displayWindowed'), value: 'windowed' as DisplayMode },
  { label: t('instSettings.displayFullscreen'), value: 'fullscreen' as DisplayMode },
  { label: t('instSettings.displayBorderless'), value: 'borderless' as DisplayMode },
])

const displayMode = computed({
  get: (): DisplayMode => {
    const s = settings.value
    if (!s) return 'windowed'
    return s.default_display_mode ?? (s.default_fullscreen ? 'fullscreen' : 'windowed')
  },
  set: (mode: DisplayMode) => {
    if (!settings.value) return
    settings.value.default_display_mode = mode
    settings.value.default_fullscreen = mode === 'fullscreen'
  },
})

const defJavaArgs = computed({
  get: () => settings.value?.default_java_args.join(' ') ?? '',
  set: (v: string) => { if (settings.value) settings.value.default_java_args = v.split(/\s+/).filter(Boolean) },
})

const memoryGb = computed(() => (settings.value?.default_memory_mb ?? 0) / 1024)
const memoryWarn = computed(() => {
  const total = sysMem.totalMb.value
  const alloc = settings.value?.default_memory_mb ?? 0
  if (!total || !alloc) return false
  return alloc > total * 0.5
})

async function browseDefaultJava() {
  const p = await open({ multiple: false, directory: false })
  if (typeof p === 'string' && settings.value) settings.value.default_java_path = p
}

function resetResolution() {
  if (!settings.value) return
  settings.value.default_width = 854
  settings.value.default_height = 480
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

const THEME_META: Record<ThemeMode, { swatch: string, accent: string }> = {
  dark: { swatch: '#0d0e11', accent: '#2e7cff' },
  oled: { swatch: '#000000', accent: '#2e7cff' },
  ash: { swatch: '#1a1b1d', accent: '#8b93a1' },
  midnight: { swatch: '#0c101c', accent: '#4d8dff' },
  ember: { swatch: '#181210', accent: '#e8953a' },
  aurora: { swatch: '#0c1515', accent: '#2dd4bf' },
}

const themeOptions = computed(() =>
  (Object.keys(THEME_META) as ThemeMode[]).map(value => ({
    value,
    label: t(`settings.appearance.themes.${value}`),
    ...THEME_META[value],
  })),
)

const previewTokens = computed(() => {
  const m = theme.mode
  const map: Record<ThemeMode, { canvas: string, stage: string, surface: string, surface2: string, surface3: string, line: string, lineStrong: string, accent: string }> = {
    dark: { canvas: '#0a0b0d', stage: '#0d0e11', surface: '#111317', surface2: '#15171b', surface3: '#1c1f24', line: '#1f2228', lineStrong: '#2b2f36', accent: '#2e7cff' },
    oled: { canvas: '#000000', stage: '#000000', surface: '#0a0a0a', surface2: '#111111', surface3: '#1a1a1a', line: '#1c1c1c', lineStrong: '#2a2a2a', accent: '#2e7cff' },
    ash: { canvas: '#121314', stage: '#161718', surface: '#1a1b1d', surface2: '#202224', surface3: '#282a2d', line: '#2e3034', lineStrong: '#3a3d42', accent: '#8b93a1' },
    midnight: { canvas: '#06080f', stage: '#080b14', surface: '#0c101c', surface2: '#111827', surface3: '#182038', line: '#1c2740', lineStrong: '#2a3a5c', accent: '#4d8dff' },
    ember: { canvas: '#0e0b09', stage: '#120e0b', surface: '#181210', surface2: '#1f1714', surface3: '#2a1f1a', line: '#322620', lineStrong: '#45352c', accent: '#e8953a' },
    aurora: { canvas: '#060c0c', stage: '#081010', surface: '#0c1515', surface2: '#11201f', surface3: '#182b2a', line: '#1e3534', lineStrong: '#2c4a48', accent: '#2dd4bf' },
  }
  return map[m]
})

const LOCALE_META: Record<string, { native: string }> = {
  en: { native: 'English' },
  fr: { native: 'Français' },
  de: { native: 'Deutsch' },
  es: { native: 'Español' },
  pl: { native: 'Polski' },
  ru: { native: 'Русский' },
  zh: { native: '中文' },
}

const localeChoices = computed(() =>
  Object.entries(LOCALE_META).map(([code, meta]) => ({
    code,
    ...meta,
    name: t(`settings.language.names.${code}`),
  })),
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

async function onSwiftAuth() {
  swiftError.value = null
  swiftBusy.value = true
  try {
    await backend.login(swiftUser.value.trim(), swiftPass.value)
    swiftPass.value = ''
    toast.add({ title: t('settings.swift.welcome', { name: backend.session.value?.username ?? '' }), color: 'success' })
  } catch (e) {
    swiftError.value = errorText(e)
  } finally {
    swiftBusy.value = false
  }
}

async function onSwiftRegister() {
  swiftError.value = null
  swiftBusy.value = true
  try {
    await backend.register(swiftUser.value.trim(), swiftPass.value)
    swiftPass.value = ''
    toast.add({ title: t('settings.swift.welcome', { name: backend.session.value?.username ?? '' }), color: 'success' })
  } catch (e) {
    swiftError.value = errorText(e)
  } finally {
    swiftBusy.value = false
  }
}

async function onSwiftLogout() {
  await backend.logout()
}

async function onSwiftLink() {
  swiftError.value = null
  swiftBusy.value = true
  try {
    await backend.linkMinecraft()
    toast.add({ title: t('settings.swift.linked'), color: 'success' })
  } catch (e) {
    swiftError.value = errorText(e)
  } finally {
    swiftBusy.value = false
  }
}
</script>
