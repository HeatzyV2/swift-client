<template>
  <div class="flex h-full">
    <!-- Sections, grouped, with a search across every setting -->
    <nav class="flex w-[264px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-[var(--sw-line)] bg-[var(--sw-stage)] px-4 pb-4 pt-6">
      <UInput
        v-model="query"
        icon="i-lucide-search"
        :placeholder="t('settings.search')"
        class="mb-4 w-full"
        :ui="{ base: 'h-10 rounded-[10px]' }"
      />

      <div v-for="group in visibleGroups" :key="group.id" class="mb-3">
        <p class="sw-eyebrow mb-1.5 px-2.5 text-[10.5px]">{{ t(`settings.nav.${group.id}`) }}</p>
        <button
          v-for="s in group.items"
          :key="s.key"
          type="button"
          class="sw-set-nav"
          :class="{ 'is-active': section === s.key }"
          @click="section = s.key"
        >
          <span class="sw-set-nav-icon">
            <UIcon :name="s.icon" class="size-4" />
          </span>
          <span class="min-w-0 flex-1 truncate">{{ t(`settings.sections.${s.key}`) }}</span>
          <span v-if="s.key === 'about' && updateAvailable" class="size-2 shrink-0 rounded-full bg-primary" />
        </button>
      </div>
      <p v-if="!visibleGroups.length" class="px-2.5 py-6 text-center text-[12.5px] text-muted">{{ t('settings.noResults') }}</p>

      <div class="flex-1" />
      <p class="px-2.5 pt-4 font-mono text-[11px] text-dimmed">{{ BRAND.name }} v{{ version }}</p>
    </nav>

    <div ref="scroller" class="min-w-0 flex-1 overflow-y-auto">
      <div class="max-w-[900px] px-[clamp(24px,4vw,56px)] pb-14 pt-8">
        <!-- Section header -->
        <header :key="section" class="sw-rise-in mb-7 flex items-center gap-4">
          <span class="sw-settings-icon size-12! rounded-[13px]!">
            <UIcon :name="current.icon" class="size-6" />
          </span>
          <div class="min-w-0">
            <h2 class="font-headline text-[34px] font-extrabold! uppercase leading-none text-highlighted">{{ t(`settings.sections.${section}`) }}</h2>
            <p class="mt-1.5 text-[13.5px] text-muted">{{ t(`settings.sectionDesc.${section}`) }}</p>
          </div>
        </header>

        <div v-if="!settings && needsSettings" class="space-y-4">
          <div v-for="n in 3" :key="n" class="sw-skeleton h-28 rounded-[14px]" />
        </div>

        <!-- Appearance: theme, language, Zip -->
        <SettingsAppearance v-else-if="section === 'appearance'" />

        <!-- Accounts -->
        <template v-else-if="section === 'accounts'">
          <SettingsGroup :title="t('settings.accounts.title')" icon="i-lucide-users" :description="t('settings.accounts.listDesc')">
            <p v-if="!accounts.accounts.length" class="sw-home-empty justify-center py-8">
              {{ t('settings.accounts.noAccounts') }}
            </p>
            <div v-else class="grid gap-3 sm:grid-cols-2">
              <div
                v-for="acc in accounts.accounts"
                :key="acc.uuid"
                class="sw-option flex! items-center gap-3"
                :class="{ 'is-active': acc.uuid === accounts.activeUuid }"
              >
                <AccountAvatar :account="acc" :face="acc.uuid === accounts.activeUuid ? activeFace : null" class="size-12 rounded-[10px]" />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-[14.5px] font-bold text-highlighted">{{ acc.username }}</p>
                  <p class="flex items-center gap-1.5 text-[12px] text-dimmed">
                    <UIcon :name="acc.kind === 'microsoft' ? 'i-lucide-shield-check' : 'i-lucide-wifi-off'" class="size-3.5" />
                    {{ t(`account.kind.${acc.kind}`) }}
                  </p>
                </div>
                <UBadge v-if="acc.uuid === accounts.activeUuid" color="primary" variant="subtle" :label="t('settings.accounts.active')" />
                <UButton v-else size="xs" color="neutral" variant="soft" :label="t('settings.accounts.use')" @click="accounts.setActive(acc.uuid)" />
                <UTooltip :text="t('common.remove')">
                  <UButton icon="i-lucide-trash-2" size="xs" color="neutral" variant="ghost" :aria-label="t('common.remove')" @click="accounts.remove(acc.uuid)" />
                </UTooltip>
              </div>
            </div>
          </SettingsGroup>

          <SettingsGroup :title="t('settings.accounts.add')" icon="i-lucide-user-plus">
            <div class="grid gap-3 md:grid-cols-2">
              <div class="sw-block-flat flex flex-col gap-3 p-4">
                <div>
                  <p class="flex items-center gap-2 text-[13.5px] font-semibold text-highlighted">
                    <UIcon name="i-lucide-shield-check" class="size-4 text-primary" />{{ t('account.microsoftTitle') }}
                  </p>
                  <p class="mt-1 text-[12.5px] leading-relaxed text-muted">{{ t('account.microsoftDesc') }}</p>
                </div>
                <UButton icon="i-lucide-log-in" :label="t('settings.accounts.microsoft')" :loading="accounts.loading" class="mt-auto justify-center" @click="onMicrosoftLogin" />
              </div>
              <div class="sw-block-flat flex flex-col gap-3 p-4">
                <div>
                  <p class="flex items-center gap-2 text-[13.5px] font-semibold text-highlighted">
                    <UIcon name="i-lucide-wifi-off" class="size-4 text-dimmed" />{{ t('settings.accounts.offline') }}
                  </p>
                  <p class="mt-1 text-[12.5px] leading-relaxed text-muted">{{ t('settings.accounts.offlineHint') }}</p>
                </div>
                <form class="mt-auto flex gap-2" @submit.prevent="onOfflineLogin">
                  <UInput v-model="offlineName" :placeholder="t('settings.accounts.offlineUsername')" class="flex-1" />
                  <UButton type="submit" color="neutral" variant="soft" icon="i-lucide-plus" :label="t('common.add')" :disabled="offlineName.trim().length < 3" />
                </form>
              </div>
            </div>
            <p v-if="accounts.error" class="pt-3 text-xs text-error">{{ accounts.error }}</p>
          </SettingsGroup>

          <SettingsGroup v-if="backend.configured.value" :title="t('settings.swift.title')" icon="i-lucide-cloud">
            <template v-if="backend.session.value">
              <SettingsRow :label="t('settings.swift.signedIn')" :description="backend.session.value.username" icon="i-lucide-user-round-check">
                <div class="flex items-center gap-2">
                  <UBadge v-if="backend.session.value.mc_username" color="success" variant="subtle" :label="backend.session.value.mc_username" />
                  <UButton v-else size="xs" color="neutral" variant="soft" :label="t('settings.swift.linkMinecraft')" :loading="swiftBusy" @click="onSwiftLink" />
                  <UButton size="xs" color="neutral" variant="ghost" :label="t('settings.swift.logout')" @click="onSwiftLogout" />
                </div>
              </SettingsRow>
            </template>
            <template v-else>
              <SettingsRow :label="t('settings.swift.desc')" stacked>
                <form class="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]" @submit.prevent="onSwiftAuth">
                  <UInput v-model="swiftUser" :placeholder="t('settings.swift.username')" autocomplete="username" />
                  <UInput v-model="swiftPass" type="password" :placeholder="t('settings.swift.password')" autocomplete="current-password" />
                  <UButton type="submit" :loading="swiftBusy" :label="t('settings.swift.login')" class="justify-center" />
                  <UButton type="button" color="neutral" variant="soft" :loading="swiftBusy" :label="t('settings.swift.register')" class="justify-center" @click="onSwiftRegister" />
                </form>
              </SettingsRow>
            </template>
            <p v-if="swiftError" class="pt-3 text-xs text-error">{{ swiftError }}</p>
          </SettingsGroup>
        </template>

        <!-- Minecraft / game -->
        <template v-else-if="section === 'minecraft' && settings">
          <SettingsGroup :title="t('settings.minecraft.memoryTitle')" icon="i-lucide-memory-stick" :description="t('settings.minecraft.memoryHint')">
            <template #actions>
              <UButton size="sm" color="neutral" variant="soft" icon="i-lucide-zap" :label="t('settings.minecraft.autoMemory')" :loading="autoMemoryBusy" @click="autoMemory" />
            </template>
            <div>
              <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
                <p class="font-headline text-[56px] font-extrabold! leading-[0.85] tabular-nums text-highlighted">
                  {{ memoryGb.toFixed(1) }}<span class="ml-1.5 text-[26px] text-muted">{{ t('settings.minecraft.gb') }}</span>
                </p>
                <p v-if="sysMem.totalMb.value" class="text-[12.5px] text-muted">
                  {{ t('settings.minecraft.memoryUsage', { total: (sysMem.totalMb.value / 1024).toFixed(0) }) }}
                </p>
              </div>
              <USlider v-model="settings.default_memory_mb" :min="sysMem.minMb" :max="sysMem.maxMb.value" :step="256" class="mb-3" />
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="gb in memoryPresets"
                  :key="gb"
                  type="button"
                  class="rounded-[8px] border px-3 py-1 font-mono text-[12px] tabular-nums transition-colors"
                  :class="settings.default_memory_mb === gb * 1024
                    ? 'border-[var(--sw-accent)] bg-[var(--sw-accent-soft)] text-highlighted'
                    : 'border-[var(--sw-line)] text-muted hover:border-[var(--sw-line-strong)] hover:text-highlighted'"
                  @click="settings.default_memory_mb = gb * 1024"
                >
                  {{ gb }} {{ t('settings.minecraft.gb') }}
                </button>
              </div>
              <p v-if="memoryWarn" class="mt-3 flex items-start gap-2 text-xs text-[var(--sw-warning)]">
                <UIcon name="i-lucide-octagon-alert" class="mt-px size-3.5 shrink-0" />
                {{ t('settings.minecraft.memoryWarn') }}
              </p>
              <p v-if="autoMemoryNote" class="mt-3 flex items-start gap-2 text-xs text-[var(--sw-accent)]">
                <UIcon name="i-lucide-zap" class="mt-px size-3.5 shrink-0" />
                {{ autoMemoryNote }}
              </p>
            </div>
          </SettingsGroup>

          <SettingsGroup :title="t('settings.minecraft.windowTitle')" icon="i-lucide-monitor" :description="t('instSettings.displayModeDesc')">
            <div class="pb-4">
              <SettingsChoices v-model="displayMode" :items="displayModeItems" />
            </div>
            <SettingsRow :label="t('settings.minecraft.resolution')" :description="t('settings.minecraft.resolutionDesc')" icon="i-lucide-ruler">
              <div class="flex items-center gap-2">
                <UInput v-model.number="settings.default_width" type="number" placeholder="854" class="w-24" :disabled="displayMode === 'fullscreen'" />
                <span class="text-dimmed">×</span>
                <UInput v-model.number="settings.default_height" type="number" placeholder="480" class="w-24" :disabled="displayMode === 'fullscreen'" />
                <UTooltip :text="t('settings.minecraft.resetResolution')">
                  <UButton color="neutral" variant="ghost" icon="i-lucide-undo-2" square :aria-label="t('settings.minecraft.resetResolution')" :disabled="displayMode === 'fullscreen'" @click="resetResolution" />
                </UTooltip>
              </div>
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup :title="t('settings.java.title')" icon="i-lucide-coffee" :description="t('settings.java.detectedDesc')">
            <template #actions>
              <UButton icon="i-lucide-radar" size="sm" color="neutral" variant="soft" :loading="java.scanning.value" :label="t('settings.java.autoDetect')" @click="java.scan()" />
            </template>
            <SettingsRow :label="t('settings.java.defaultPath')" :description="t('settings.java.defaultPathHint')" stacked>
              <div class="flex gap-2">
                <UInput v-model="settings.default_java_path" :placeholder="t('settings.java.managed')" class="flex-1 font-mono text-xs" />
                <UButton icon="i-lucide-folder-open" color="neutral" variant="soft" square :aria-label="t('settings.java.browse')" @click="browseDefaultJava" />
                <UButton v-if="settings.default_java_path" icon="i-lucide-x" color="neutral" variant="ghost" square :aria-label="t('common.remove')" @click="settings.default_java_path = undefined" />
              </div>
            </SettingsRow>
            <div class="pt-4">
              <p v-if="!java.installations.value.length && !java.scanning.value" class="sw-home-empty justify-center">
                {{ t('settings.java.noJava') }}
              </p>
              <ul v-else class="grid grid-cols-[minmax(0,1fr)] gap-2">
                <li
                  v-for="inst in java.installations.value"
                  :key="inst.path"
                  class="sw-block-flat flex items-center gap-3 px-3.5 py-2.5"
                  :class="settings.default_java_path === inst.path ? 'border-[var(--sw-accent)]!' : ''"
                >
                  <span class="font-headline flex size-10 shrink-0 items-center justify-center rounded-[9px] bg-[var(--sw-surface-3)] text-[20px] text-highlighted">{{ inst.major ?? '?' }}</span>
                  <div class="min-w-0 flex-1">
                    <p class="flex items-center gap-2 text-[13px]">
                      <span class="font-semibold text-highlighted">Java {{ inst.major ?? '?' }}</span>
                      <span class="font-mono text-[11px] text-dimmed">{{ inst.version }}</span>
                      <span v-if="inst.vendor" class="truncate text-[11px] text-dimmed">· {{ inst.vendor }}</span>
                    </p>
                    <p class="truncate font-mono text-[11px] text-dimmed" :title="inst.path">{{ inst.path }}</p>
                  </div>
                  <UBadge v-if="settings.default_java_path === inst.path" color="primary" variant="subtle" size="sm" :label="t('settings.java.isDefault')" />
                  <UButton v-else size="xs" color="neutral" variant="soft" :label="t('settings.java.setDefault')" @click="settings.default_java_path = inst.path" />
                </li>
              </ul>
            </div>
          </SettingsGroup>
        </template>

        <!-- Swift Client mod: channel, updates, versions -->
        <SettingsSwiftMod v-else-if="section === 'swiftmod' && settings" :settings="settings" />

        <!-- Sync -->
        <SettingsGroup v-else-if="section === 'sync'">
          <SyncSettings />
        </SettingsGroup>

        <!-- Privacy / options -->
        <template v-else-if="section === 'privacy' && settings">
          <SettingsGroup :title="t('settings.privacy.title')" icon="i-lucide-sliders-horizontal">
            <SettingsRow :label="t('settings.privacy.track_playtime')" :description="t('settings.privacy.track_playtimeDesc')" icon="i-lucide-clock">
              <USwitch v-model="settings.track_playtime" />
            </SettingsRow>
            <SettingsRow :label="t('settings.privacy.discord_rpc')" :description="t('settings.privacy.discord_rpcDesc')" icon="i-simple-icons-discord">
              <USwitch v-model="settings.discord_rpc" />
            </SettingsRow>
            <SettingsRow v-if="backend.configured.value" :label="t('settings.privacy.analytics')" :description="t('settings.privacy.analyticsDesc')" icon="i-lucide-chart-no-axes-column">
              <USwitch :model-value="analytics" @update:model-value="setAnalytics" />
            </SettingsRow>
          </SettingsGroup>
          <p class="sw-block-flat flex items-start gap-3 px-4 py-3.5 text-[12.5px] leading-relaxed text-muted">
            <UIcon name="i-lucide-shield-check" class="mt-px size-4 shrink-0 text-[var(--sw-accent)]" />
            {{ t('settings.privacy.noTelemetry') }}
          </p>
        </template>

        <!-- Folders and launch options -->
        <template v-else-if="section === 'advanced' && settings">
          <SettingsGroup :title="t('settings.advanced.filesTitle')" icon="i-lucide-folder">
            <div class="grid gap-3 md:grid-cols-3">
              <button
                v-for="folder in folders"
                :key="folder.key"
                type="button"
                class="sw-option group"
                :disabled="!folder.path"
                @click="reveal(folder.path)"
              >
                <span class="flex items-center justify-between">
                  <UIcon :name="folder.icon" class="size-5 text-primary" />
                  <UIcon name="i-lucide-arrow-up-right" class="size-4 text-dimmed transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-highlighted" />
                </span>
                <span class="mt-3 block text-[13.5px] font-semibold text-highlighted">{{ t(`settings.advanced.folders.${folder.key}`) }}</span>
                <span class="mt-0.5 block truncate font-mono text-[11px] text-dimmed" :title="folder.path">{{ folder.path || '—' }}</span>
              </button>
            </div>
          </SettingsGroup>

          <SettingsGroup :title="t('diagnostics.title')" icon="i-lucide-stethoscope">
            <SettingsRow :label="t('diagnostics.export')" :description="t('diagnostics.exportDesc')">
              <UButton icon="i-lucide-archive" color="neutral" variant="soft" :label="t('diagnostics.exportButton')" :loading="diagBusy" @click="exportDiagnostics" />
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup :title="t('settings.advanced.launchTitle')" icon="i-lucide-terminal">
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

          <SettingsGroup :title="t('settings.advanced.hooksTitle')" icon="i-lucide-workflow">
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
          <section class="sw-settings-card relative mb-5 overflow-hidden p-0!">
            <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_120%_at_0%_0%,color-mix(in_srgb,var(--sw-accent)_22%,transparent),transparent_70%)]" />
            <div class="relative flex flex-wrap items-center gap-5 p-6">
              <div class="flex size-[72px] shrink-0 items-center justify-center rounded-[18px] border border-[var(--sw-line-strong)] bg-[var(--sw-canvas)] shadow-[0_10px_30px_-12px_var(--sw-accent)]">
                <BrandMark class="size-10 text-[var(--sw-accent)]" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="font-headline text-[34px] font-extrabold! uppercase leading-none text-highlighted">{{ BRAND.name }}</p>
                <p class="mt-1.5 flex items-center gap-2 text-[13px] text-muted">
                  <span class="rounded-[6px] bg-[var(--sw-surface-3)] px-1.5 py-0.5 font-mono text-[11.5px] text-toned">v{{ version }}</span>
                  <UIcon :name="updateIcon" class="size-4" :class="updateAvailable ? 'text-primary' : updateError ? 'text-[var(--sw-warning)]' : 'text-[var(--sw-success)]'" />
                  {{ updateTitle }}
                </p>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <UButton v-if="updateAvailable" icon="i-lucide-download" :loading="updateBusy" :label="t('settings.about.install')" @click="installUpdate" />
                <UButton color="neutral" variant="soft" icon="i-lucide-refresh-cw" :loading="updateBusy" :label="t('settings.about.check')" @click="checkUpdate" />
              </div>
            </div>
            <p class="relative border-t border-[var(--sw-line)] px-6 py-3 text-[12.5px] text-muted">{{ updateDesc }}</p>
          </section>

          <SettingsGroup>
            <SettingsRow :label="t('settings.about.online')" :description="backend.configured.value ? t('settings.about.onlineOn') : t('settings.about.onlineOff')" icon="i-lucide-globe">
              <UBadge :color="backend.configured.value ? 'success' : 'neutral'" variant="subtle" :label="backend.configured.value ? t('settings.about.connected') : t('settings.about.offline')" />
            </SettingsRow>
            <SettingsRow v-if="LINKS.discord" :label="t('settings.about.community')" :description="t('settings.about.communityDesc')" icon="i-simple-icons-discord">
              <UButton color="neutral" variant="soft" trailing-icon="i-lucide-arrow-up-right" label="Discord" @click="openExternal(LINKS.discord)" />
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
import type { DisplayMode, LauncherPaths, MemoryAdvice, Settings } from '~/types/launcher'
import { LINKS } from '~/content/links'

const { t } = useI18n()
const route = useRoute()
const accounts = useAccountStore()
const java = useJava()
const sysMem = useSystemMemory()
const backend = useBackend()
const toast = useToast()

// Anonymous usage data towards the Swift Platform: opt-in, off until the player turns it on
const analytics = ref(false)
onMounted(async () => {
  try { analytics.value = (await invoke<{ enabled: boolean }>('platform_telemetry_status')).enabled } catch { /* not in Tauri */ }
})
async function setAnalytics(value: boolean) {
  analytics.value = value
  try { await invoke('platform_set_telemetry', { enabled: value }) } catch (e) { toast.add({ title: errorText(e), color: 'error' }) }
  setTelemetryEnabled(value)
}

type Section = 'appearance' | 'accounts' | 'minecraft' | 'swiftmod' | 'sync' | 'privacy' | 'advanced' | 'about'

/** `finds`: i18n keys of what the section holds, so the search finds it by its settings too. */
interface NavItem { key: Section, icon: string, finds: string[] }

const navGroups: { id: string, items: NavItem[] }[] = [
  {
    id: 'display',
    items: [{ key: 'appearance', icon: 'i-lucide-palette', finds: ['settings.appearance.theme', 'settings.language.title', 'swiftx.zip.settingLabel'] }],
  },
  {
    id: 'game',
    items: [
      { key: 'minecraft', icon: 'i-lucide-box', finds: ['settings.minecraft.memoryTitle', 'settings.minecraft.windowTitle', 'settings.minecraft.resolution', 'instSettings.displayBorderless', 'settings.java.title'] },
      { key: 'swiftmod', icon: 'i-lucide-zap', finds: ['swiftMod.channel', 'swiftMod.auto', 'swiftMod.versionsTitle'] },
    ],
  },
  {
    id: 'launcher',
    items: [
      { key: 'accounts', icon: 'i-lucide-users', finds: ['settings.accounts.microsoft', 'settings.accounts.offline', 'settings.swift.title'] },
      { key: 'sync', icon: 'i-lucide-refresh-cw', finds: ['sync.title'] },
      { key: 'privacy', icon: 'i-lucide-sliders-horizontal', finds: ['settings.privacy.track_playtime', 'settings.privacy.discord_rpc', 'settings.privacy.analytics'] },
      { key: 'advanced', icon: 'i-lucide-folder', finds: ['settings.advanced.filesTitle', 'diagnostics.title', 'settings.advanced.launchTitle', 'settings.advanced.hooksTitle', 'instSettings.customJavaArgs'] },
      { key: 'about', icon: 'i-lucide-info', finds: ['settings.about.updates', 'settings.about.online'] },
    ],
  },
]

/** Sections whose name, description or settings match the search (accents ignored). */
const query = ref('')
const fold = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const visibleGroups = computed(() => {
  const q = fold(query.value.trim())
  if (!q) return navGroups
  return navGroups
    .map(g => ({
      ...g,
      items: g.items.filter(i => [`settings.sections.${i.key}`, `settings.sectionDesc.${i.key}`, ...i.finds].some(k => fold(t(k)).includes(q))),
    }))
    .filter(g => g.items.length)
})

const allSections = navGroups.flatMap(g => g.items)
const initial = route.query.section as string | undefined
/** Map legacy `general` deep-links to the new appearance section. */
const resolvedInitial: Section | undefined
  = initial === 'general'
    ? 'appearance'
    : (allSections.some(s => s.key === initial) ? initial as Section : undefined)
const section = ref<Section>(resolvedInitial ?? 'appearance')
const current = computed(() => allSections.find(s => s.key === section.value)!)
const activeFace = usePlayerFace()

// A new section starts at the top; a search jumps to its first match
const scroller = ref<HTMLElement | null>(null)
watch(section, () => scroller.value?.scrollTo({ top: 0 }))
watch(visibleGroups, (groups) => {
  const keys = groups.flatMap(g => g.items.map(i => i.key))
  if (query.value.trim() && keys.length && !keys.includes(section.value)) section.value = keys[0]!
})
const needsSettings = computed(() => ['minecraft', 'swiftmod', 'privacy', 'advanced'].includes(section.value))

const offlineName = ref('')
const settings = ref<Settings | null>(null)
const version = ref('')
const paths = ref<LauncherPaths | null>(null)
const swiftUser = ref('')
const swiftPass = ref('')
const swiftBusy = ref(false)
const swiftError = ref<string | null>(null)

const updater = useUpdater()
const { available: updateAvailable, version: updateVersion, error: updateError, busy: updateBusy } = updater

const updateIcon = computed(() => {
  if (updateError.value) return 'i-lucide-triangle-alert'
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
  try {
    if (!(await updater.checkForUpdate())) {
      toast.add({ title: t('settings.about.upToDate'), color: 'success', icon: 'i-lucide-circle-check' })
    }
  } catch (e) {
    toast.add({ title: t('settings.about.noEndpoint'), description: errorText(e), color: 'neutral' })
  }
}

async function installUpdate() {
  if (updater.blocked.value) {
    toast.add({ title: t('settings.about.updateBlocked'), color: 'warning', icon: 'i-lucide-gamepad-2' })
    return
  }
  try {
    await updater.install()
  } catch (e) {
    toast.add({ title: errorText(e), color: 'error' })
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
  { value: 'windowed' as DisplayMode, icon: 'i-lucide-app-window', label: t('instSettings.displayWindowed'), description: t('settings.minecraft.displayDesc.windowed') },
  { value: 'borderless' as DisplayMode, icon: 'i-lucide-scan', label: t('instSettings.displayBorderless'), description: t('settings.minecraft.displayDesc.borderless') },
  { value: 'fullscreen' as DisplayMode, icon: 'i-lucide-maximize', label: t('instSettings.displayFullscreen'), description: t('settings.minecraft.displayDesc.fullscreen') },
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

/** Common amounts, within what this computer allows. */
const memoryPresets = computed(() => [2, 4, 6, 8, 12, 16].filter(gb => gb * 1024 >= sysMem.minMb && gb * 1024 <= sysMem.maxMb.value))

const memoryGb = computed(() => (settings.value?.default_memory_mb ?? 0) / 1024)
const memoryWarn = computed(() => {
  const total = sysMem.totalMb.value
  const alloc = settings.value?.default_memory_mb ?? 0
  if (!total || !alloc) return false
  return alloc > total * 0.5
})

const autoMemoryBusy = ref(false)
const autoMemoryNote = ref('')
/** The launcher picks a RAM value from this computer's memory instead of the player guessing one. */
async function autoMemory() {
  if (!settings.value) return
  autoMemoryBusy.value = true
  try {
    const advice = await invoke<MemoryAdvice>('recommend_memory', { instanceId: null })
    settings.value.default_memory_mb = advice.recommended_mb
    autoMemoryNote.value = t('settings.minecraft.autoMemoryApplied', {
      gb: (advice.recommended_mb / 1024).toFixed(1),
      reason: t(`settings.minecraft.memoryReason.${advice.reason}`),
    })
  } catch (e) {
    toast.add({ title: errorText(e), color: 'error' })
  } finally {
    autoMemoryBusy.value = false
  }
}

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

const folders = computed(() => [
  { key: 'data', icon: 'i-lucide-hard-drive', path: paths.value?.data_root ?? '' },
  { key: 'instances', icon: 'i-lucide-layout-grid', path: paths.value?.instances ?? '' },
  { key: 'logs', icon: 'i-lucide-scroll-text', path: paths.value?.logs ?? '' },
])

async function reveal(path: string) {
  try {
    await invoke('reveal_in_explorer', { path })
  } catch (e) {
    toast.add({ title: errorText(e), color: 'error' })
  }
}

const diagBusy = ref(false)
async function exportDiagnostics() {
  diagBusy.value = true
  try {
    const path = await invoke<string>('export_diagnostics')
    toast.add({
      title: t('diagnostics.done'),
      description: path,
      color: 'success',
      actions: [{ label: t('diagnostics.show'), onClick: () => { invoke('reveal_in_explorer', { path }).catch(() => {}) } }],
    })
  } catch (e) {
    toast.add({ title: errorText(e), color: 'error' })
  } finally {
    diagBusy.value = false
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

<style scoped>
.sw-set-nav {
  position: relative;
  display: flex;
  width: 100%;
  height: 42px;
  flex-shrink: 0;
  align-items: center;
  gap: 11px;
  padding: 0 10px 0 6px;
  border-radius: 10px;
  text-align: left;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ui-text-muted);
  transition: background-color 160ms var(--ease-swift), color 160ms var(--ease-swift);
}
.sw-set-nav:hover,
.sw-set-nav.is-active {
  color: var(--ui-text-highlighted);
  background: var(--sw-surface-2);
}
.sw-set-nav.is-active::before {
  content: '';
  position: absolute;
  left: -16px;
  top: 10px;
  bottom: 10px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--sw-accent);
  box-shadow: 0 0 12px var(--sw-accent);
}
.sw-set-nav-icon {
  display: flex;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1px solid var(--sw-line);
  background: var(--sw-surface);
  transition: background-color 160ms var(--ease-swift), color 160ms var(--ease-swift), border-color 160ms var(--ease-swift);
}
.sw-set-nav.is-active .sw-set-nav-icon {
  border-color: color-mix(in srgb, var(--sw-accent) 35%, transparent);
  background: var(--sw-accent-soft);
  color: var(--sw-accent);
}
</style>
