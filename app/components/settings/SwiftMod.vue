<template>
  <div>
    <!-- Where the mod stands, for the chosen Minecraft version -->
    <section class="sw-settings-card relative mb-5 overflow-hidden p-0!">
      <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_120%_at_0%_0%,color-mix(in_srgb,var(--sw-accent)_18%,transparent),transparent_70%)]" />
      <div class="relative flex flex-wrap items-center gap-4 p-5">
        <span class="sw-settings-icon size-12! rounded-[13px]!">
          <UIcon :name="headline.icon" class="size-6" :class="{ 'animate-spin': !mod.status.value }" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-[15px] font-semibold text-highlighted">{{ headline.title }}</p>
          <p class="mt-0.5 text-[12.5px] text-muted">{{ headline.desc }}</p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <UButton
            v-if="mod.status.value?.update_available && mod.status.value.channel !== 'local'"
            icon="i-lucide-download"
            :loading="mod.busy.value"
            :label="t('swiftMod.install')"
            @click="install"
          />
          <UButton
            v-if="mod.status.value?.channel !== 'local'"
            color="neutral"
            variant="soft"
            icon="i-lucide-refresh-cw"
            :loading="mod.busy.value"
            :label="t('swiftMod.check')"
            @click="check"
          />
        </div>
      </div>

      <div class="relative flex flex-wrap items-center justify-between gap-3 border-t border-[var(--sw-line)] px-5 py-3">
        <span class="text-[12.5px] font-medium text-muted">{{ t('create.custom.gameVersion') }}</span>
        <USelectMenu v-model="mod.mcVersion.value" :items="minecraftVersions" :disabled="mod.busy.value" class="w-44" />
      </div>

      <div v-if="mod.progress.value" class="relative border-t border-[var(--sw-line)] px-5 py-3">
        <UProgress :model-value="mod.percent.value" :max="100" size="xs" />
        <p class="mt-1.5 flex justify-between text-[11px] tabular-nums text-dimmed">
          <span>{{ t('swiftMod.updating', { version: mod.progress.value.version }) }}</span>
          <span>{{ fmtMb(mod.progress.value.received) }} / {{ fmtMb(mod.progress.value.total) }} MB · {{ mod.percent.value }}%</span>
        </p>
      </div>

      <p v-if="mod.error.value" class="relative border-t border-[var(--sw-line)] px-5 py-3 text-xs text-error">{{ mod.error.value }}</p>
    </section>

    <SettingsGroup :title="t('swiftMod.channel')" icon="i-lucide-git-branch" :description="t('swiftMod.channelDesc')">
      <div class="pb-4">
        <SettingsChoices :model-value="settings.mod_channel" :items="channelItems" @update:model-value="setChannel" />
      </div>
      <SettingsRow :label="t('swiftMod.auto')" :description="t('swiftMod.autoDesc')" icon="i-lucide-refresh-ccw-dot">
        <USwitch :model-value="settings.mod_auto_update" :disabled="settings.mod_channel === 'local'" @update:model-value="setAuto" />
      </SettingsRow>
    </SettingsGroup>

    <SettingsGroup :title="t('swiftMod.versionsTitle')" icon="i-lucide-history" :description="t('swiftMod.versionsDesc')">
      <p v-if="mod.status.value?.pinned" class="mb-3 flex items-center gap-2 rounded-[10px] bg-[var(--sw-warning)]/10 px-3 py-2 text-xs text-[var(--sw-warning)]">
        <UIcon name="i-lucide-pin" class="size-3.5 shrink-0" />
        <span class="flex-1">{{ t('swiftMod.pinNote', { version: mod.status.value.pinned }) }}</span>
        <UButton size="xs" color="neutral" variant="soft" :label="t('swiftMod.unpin')" :loading="mod.busy.value" @click="unpin" />
      </p>

      <ul v-if="versions.length" class="grid grid-cols-[minmax(0,1fr)] gap-2">
        <li
          v-for="v in versions"
          :key="v.version"
          class="sw-block-flat flex items-center gap-3 px-3.5 py-2.5"
          :class="v.current ? 'border-[var(--sw-accent)]!' : ''"
        >
          <UIcon :name="v.current ? 'i-lucide-circle-check' : 'i-lucide-package'" class="size-4 shrink-0" :class="v.current ? 'text-primary' : 'text-dimmed'" />
          <div class="min-w-0 flex-1">
            <p class="flex flex-wrap items-center gap-2 font-mono text-[13px] text-highlighted">
              {{ v.version }}
              <UBadge v-if="v.current" color="primary" variant="subtle" size="sm" :label="t('swiftMod.inUse')" />
              <UBadge v-if="v.pinned" color="warning" variant="subtle" size="sm" :label="t('swiftMod.pinnedBadge')" />
              <UBadge v-if="v.version.includes('-')" color="neutral" variant="subtle" size="sm" :label="t('swiftMod.betaBadge')" />
            </p>
            <p class="text-[11px] text-dimmed">{{ t(`swiftMod.source.${v.source}`) }} · {{ fmtMb(v.size) }} MB</p>
          </div>
          <UButton
            v-if="!v.current || (v.current && !v.pinned && !isNewest(v))"
            size="xs"
            color="neutral"
            variant="soft"
            :label="t('swiftMod.useVersion')"
            :loading="mod.busy.value"
            @click="use(v.version)"
          />
        </li>
      </ul>
      <p v-else class="sw-home-empty justify-center">{{ t('swiftMod.noVersions') }}</p>
    </SettingsGroup>
  </div>
</template>

<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import type { ModVersion, Settings } from '~/types/launcher'

const props = defineProps<{ settings: Settings }>()
const { t } = useI18n()
const toast = useToast()
const mod = useSwiftMod()
const minecraftVersions = ref<string[]>([])
onMounted(async () => { minecraftVersions.value = await invoke<string[]>('swift_minecraft_versions') })
watch(mod.mcVersion, () => { mod.status.value = null; mod.refresh() })

onMounted(() => { mod.refresh() })

const channelItems = computed(() => [
  { value: 'stable' as const, icon: 'i-lucide-shield-check', label: t('swiftMod.channels.stable'), description: t('swiftMod.channelHint.stable') },
  { value: 'beta' as const, icon: 'i-lucide-flask-conical', label: t('swiftMod.channels.beta'), description: t('swiftMod.channelHint.beta') },
  { value: 'local' as const, icon: 'i-lucide-folder-code', label: t('swiftMod.channels.local'), description: t('swiftMod.channelHint.local') },
])

const versions = computed<ModVersion[]>(() => mod.status.value?.versions ?? [])
const isNewest = (v: ModVersion) => versions.value[0]?.version === v.version
const fmtMb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1)

const headline = computed(() => {
  const s = mod.status.value
  if (!s) return { icon: 'i-lucide-loader-circle', title: t('swiftMod.status.loading'), desc: '' }
  if (s.channel === 'local') {
    return { icon: 'i-lucide-folder', title: t('swiftMod.status.local'), desc: s.installed ? t('swiftMod.desc.installed', { version: s.installed }) : t('swiftMod.noVersions') }
  }
  if (s.update_available && s.latest) {
    return { icon: 'i-lucide-download', title: t('swiftMod.status.available', { version: s.latest }), desc: t('swiftMod.desc.installed', { version: s.installed ?? '—' }) }
  }
  if (s.offline) {
    return { icon: 'i-lucide-triangle-alert', title: t('swiftMod.status.offline'), desc: t('swiftMod.desc.installed', { version: s.installed ?? '—' }) }
  }
  return { icon: 'i-lucide-circle-check', title: t('swiftMod.status.upToDate', { version: s.installed ?? '—' }), desc: s.pinned ? t('swiftMod.status.pinned', { version: s.pinned }) : t('swiftMod.desc.upToDate') }
})

async function persist() {
  await invoke('save_settings', { settings: JSON.parse(JSON.stringify(props.settings)) })
}

async function setChannel(value: unknown) {
  props.settings.mod_channel = value as Settings['mod_channel']
  try {
    await persist()
    if (props.settings.mod_channel !== 'local') await mod.check()
    else await mod.refresh()
  } catch (e) {
    toast.add({ title: errorText(e), color: 'error' })
  }
}

async function setAuto(value: boolean) {
  props.settings.mod_auto_update = value
  try { await persist() } catch (e) { toast.add({ title: errorText(e), color: 'error' }) }
}

/** The pin lives in the launcher settings too: keep this copy in step so a later save does not undo it. */
function syncPin() {
  if (mod.mcVersion.value === '26.2') props.settings.mod_pinned = mod.status.value?.pinned ?? null
}

async function check() {
  try { await mod.check() } catch { /* shown through mod.error */ }
}

async function install() {
  try {
    await mod.install()
    syncPin()
    toast.add({ title: t('swiftMod.updatedToast', { version: mod.status.value?.installed ?? '' }), description: t('swiftMod.updatedToastDesc'), color: 'success' })
  } catch { /* shown through mod.error */ }
}

async function use(version: string) {
  try {
    await mod.useVersion(version)
    syncPin()
    toast.add({ title: t('swiftMod.pinnedToast', { version }), color: 'success' })
  } catch { /* shown through mod.error */ }
}

async function unpin() {
  try {
    await mod.unpin()
    syncPin()
  } catch { /* shown through mod.error */ }
}
</script>
