import { invoke } from '@tauri-apps/api/core'
import type { Ref } from 'vue'

export interface PlatformAnnouncement {
  id: string
  type: 'info' | 'success' | 'warning' | 'critical'
  title: string
  body: string
  linkUrl: string | null
  dismissible: boolean
}

export interface PlatformServer {
  id: string
  name: string
  edition: 'java' | 'bedrock' | 'crossplay'
  address: string
  port: number
  description: string
  iconUrl: string | null
  bannerUrl: string | null
  website: string | null
  tags: string[]
  featured: boolean
  verified: boolean
}

export interface PlatformCampaign {
  id: string
  placement: string
  title: string
  subtitle: string
  imageUrl: string | null
  cta: { label: string, url: string } | null
  server: { id: string, name: string, address: string, port: number } | null
}

/** A home section, already resolved by the server for this client (language, targeting, schedule). */
export interface HomeSection {
  id: string
  kind: 'hero' | 'news' | 'servers' | 'partners' | 'banner' | 'links' | 'text'
  title: string
  subtitle?: string
  badge?: string
  body?: string
  imageUrl?: string | null
  url?: string | null
  alt?: string
  cta?: { label: string, url: string } | null
  /** Server cards, campaigns or links depending on `kind` (shapes documented in docs/API.md). */
  items?: any[]
}

export interface PlatformData {
  apiVersion: number
  stale?: boolean
  maintenance: { active: boolean, message: Record<string, string>, startsAt: string | null, endsAt: string | null }
  announcements: PlatformAnnouncement[]
  home: { snapshotId: number, sections: HomeSection[] } | null
  servers: PlatformServer[]
  campaigns: PlatformCampaign[]
  flags: Record<string, boolean>
  experiments: Record<string, string>
  config: Record<string, unknown>
  links: Record<string, string | null>
  analytics: { enabled: boolean }
  update: { updateAvailable: boolean, mandatory: boolean, minimumVersion: string | null, release: { version: string } | null } | null
}

const REFRESH_MS = 15 * 60_000
const DISMISSED_KEY = 'sw-dismissed-announcements'
let started = false

function readDismissed(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]')
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string').slice(-100) : []
  } catch {
    return []
  }
}

/** Pick the message for the player's language: language, then English, French, anything. */
export function pickText(map: Record<string, string> | undefined, locale: string): string {
  if (!map) return ''
  const l = locale.toLowerCase().split(/[-_]/)[0]!
  return map[l] || map.en || map.fr || Object.values(map)[0] || ''
}

/**
 * Everything the admin platform controls on the launcher: announcements, maintenance, home sections,
 * servers, campaigns, feature flags and remote config. Loaded once at start-up (plugins/platform.client.ts),
 * refreshed every 15 minutes, and cached on disk by the backend module so it also works offline.
 */
export const useSwiftPlatform = () => {
  const data = useState<PlatformData | null>('sw-platform', () => null)
  const dismissed = useState<string[]>('sw-platform-dismissed', () => [])
  const maintenanceSeen = useState('sw-platform-maintenance-seen', () => false)
  /** The last attempt to reach the platform failed and nothing was cached: there is no data at all. */
  const unreachable = useState('sw-platform-unreachable', () => false)
  // The i18n instance of the Nuxt app works from components and from plugins alike
  const locale = (useNuxtApp().$i18n as { locale: Ref<string> }).locale
  const backend = useBackend()
  const instances = useInstancesStore()

  async function load() {
    if (!import.meta.client) return
    await backend.ready
    if (!backend.configured.value) return
    try {
      const next = await invoke<PlatformData | null>('platform_bootstrap', {
        locale: locale.value,
        authenticated: backend.accounts.value,
        mcVersion: instances.selected?.mc_version ?? null,
      })
      unreachable.value = !next
      if (next) {
        data.value = next
        setTelemetryEnabled(next.analytics?.enabled !== false && telemetryEnabled())
      }
    } catch { /* keep what we have */ }
  }

  /** Offline mode: the platform could not be reached, so what is shown comes from the last saved answer. */
  const offline = computed(() => data.value?.stale === true || unreachable.value)

  /** Telemetry is opt-in: ask once, a few seconds after start-up, and never again. */
  function askConsent() {
    const toast = useToast()
    const { t } = useNuxtApp().$i18n as { t: (key: string) => string }
    setTimeout(() => {
      const answer = async (yes: boolean) => {
        try { await invoke('platform_set_telemetry', { enabled: yes }) } catch { /* ignore */ }
        setTelemetryEnabled(yes && data.value?.analytics?.enabled !== false)
        toast.remove('telemetry-consent')
      }
      toast.add({
        id: 'telemetry-consent',
        title: t('platform.ask.title'),
        description: t('platform.ask.desc'),
        icon: 'i-lucide-shield',
        color: 'primary',
        duration: 0,
        actions: [
          { label: t('platform.ask.yes'), color: 'primary', onClick: () => { void answer(true) } },
          { label: t('platform.ask.no'), color: 'neutral', variant: 'soft', onClick: () => { void answer(false) } },
        ],
      })
    }, 10_000)
  }

  async function start() {
    if (started || !import.meta.client) return
    started = true
    dismissed.value = readDismissed()
    configureTelemetry({ locale: () => locale.value, mc: () => instances.selected?.mc_version })
    let allowed = true
    let upgradedFrom: string | null = null
    try {
      const status = await invoke<{ enabled: boolean, asked: boolean, upgraded_from: string | null }>('platform_telemetry_status')
      allowed = status.enabled
      upgradedFrom = status.upgraded_from
      if (!status.asked) askConsent()
    } catch { /* not running in Tauri */ }
    setTelemetryEnabled(allowed)
    await load()
    // The bootstrap may have switched analytics off server side
    setTelemetryEnabled(allowed && data.value?.analytics?.enabled !== false)
    track('app_open')
    if (upgradedFrom) track('update_applied', { from: upgradedFrom })
    setInterval(load, REFRESH_MS)
    document.addEventListener('visibilitychange', () => { if (document.hidden) void flushTelemetry() })
    watch(locale, () => { void load() })
  }

  const announcements = computed(() => (data.value?.announcements ?? []).filter(a => !a.dismissible || !dismissed.value.includes(a.id)))

  function dismiss(id: string) {
    dismissed.value = [...dismissed.value, id].slice(-100)
    try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed.value)) } catch { /* ignore */ }
  }

  const maintenance = computed(() => {
    const m = data.value?.maintenance
    return m?.active ? { message: pickText(m.message, locale.value), endsAt: m.endsAt } : null
  })

  function flag(key: string, fallback = false): boolean {
    const flags = data.value?.flags
    return flags && key in flags ? !!flags[key] : fallback
  }

  function config<T>(key: string, fallback: T): T {
    const v = data.value?.config?.[key]
    return v === undefined || v === null ? fallback : v as T
  }

  function variant(key: string): string {
    return data.value?.experiments?.[key] ?? 'control'
  }

  /** Home sections the admin published, unless switched off by the `home.sections` flag. */
  const homeSections = computed(() => (flag('home.sections', true) ? data.value?.home?.sections ?? [] : []))
  const servers = computed(() => data.value?.servers ?? [])
  const campaigns = computed(() => data.value?.campaigns ?? [])
  const links = computed(() => data.value?.links ?? {})

  return {
    data, load, start, offline, announcements, dismiss, maintenance, maintenanceSeen, flag, config, variant,
    homeSections, servers, campaigns, links,
  }
}
