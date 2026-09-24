<template>
  <aside class="grid min-w-0 content-start gap-3.5 md:grid-cols-3 xl:flex xl:flex-col">
    <!-- Live server status -->
    <section v-if="server" class="sw-panel p-4">
      <div class="flex items-center justify-between gap-3">
        <span class="sw-eyebrow">{{ $t('home.server.title') }}</span>
        <span class="flex items-center gap-1.5 text-[11.5px] font-medium" :class="statusClass">
          <span class="size-1.5 rounded-full bg-current shadow-[0_0_0_3px_color-mix(in_srgb,currentColor_22%,transparent)]" />
          {{ statusLabel }}
        </span>
      </div>

      <div class="mt-3 flex items-center gap-3">
        <img v-if="ping?.favicon" :src="ping.favicon" alt="" class="size-10 shrink-0 rounded-lg [image-rendering:pixelated]">
        <div v-else class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--sw-surface-3)]">
          <UIcon name="i-lucide-server" class="size-5 text-dimmed" />
        </div>
        <div class="min-w-0">
          <p class="truncate font-display text-[15px] font-semibold text-highlighted">{{ server.name || server.address }}</p>
          <p class="truncate font-mono text-[11px] text-dimmed">{{ server.address }}</p>
        </div>
      </div>

      <div class="mt-4 grid grid-cols-2 gap-2">
        <div class="rounded-lg bg-[var(--sw-surface-2)] px-3 py-2">
          <p class="font-display text-[18px] font-semibold tabular-nums text-highlighted">
            {{ ping ? ping.online.toLocaleString(locale) : '—' }}
          </p>
          <p class="text-[11px] text-dimmed">{{ $t('home.server.players') }}</p>
        </div>
        <div class="rounded-lg bg-[var(--sw-surface-2)] px-3 py-2">
          <p class="font-display text-[18px] font-semibold tabular-nums" :class="ping ? latencyClass(ping.latency_ms) : 'text-highlighted'">
            {{ ping ? `${ping.latency_ms} ms` : '—' }}
          </p>
          <p class="text-[11px] text-dimmed">{{ $t('home.server.latency') }}</p>
        </div>
      </div>

      <!-- Latency over the last few checks -->
      <svg v-if="samples.length > 1" class="mt-3 h-10 w-full" viewBox="0 0 120 32" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient :id="gradientId" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" style="stop-color: var(--sw-accent); stop-opacity: 0.35" />
            <stop offset="100%" style="stop-color: var(--sw-accent); stop-opacity: 0" />
          </linearGradient>
        </defs>
        <path :d="sparkline.area" :fill="`url(#${gradientId})`" />
        <path :d="sparkline.line" fill="none" style="stroke: var(--sw-accent)" stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-linejoin="round" />
      </svg>

      <p class="mt-2 truncate text-[11px] text-dimmed">
        {{ server.fromInstance ? $t('home.server.fromInstance', { name: server.fromInstance }) : $t('home.server.featured') }}
      </p>
    </section>

    <!-- Last session -->
    <section class="sw-panel p-4">
      <span class="sw-eyebrow">{{ $t('home.lastSession.title') }}</span>
      <NuxtLink
        v-if="lastInstance"
        :to="`/instance/${lastInstance.id}`"
        class="group mt-3 flex items-center gap-3 rounded-lg p-1.5 -m-1.5 transition-colors duration-150 hover:bg-[var(--sw-surface-2)]"
      >
        <InstanceIcon :instance="lastInstance" class="size-10 rounded-lg text-sm" />
        <span class="min-w-0 flex-1">
          <span class="block truncate font-display text-[14px] font-semibold text-highlighted">{{ lastInstance.name }}</span>
          <span class="block truncate text-[11.5px] text-dimmed">
            {{ formatRelative(lastInstance.last_played, locale) }}
            <template v-if="lastInstance.playtime_seconds"> · {{ $t('home.lastSession.total', { time: formatPlaytime(lastInstance.playtime_seconds, locale) }) }}</template>
          </span>
        </span>
        <UIcon name="i-lucide-arrow-right" class="size-4 shrink-0 text-dimmed transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-toned" />
      </NuxtLink>
      <p v-else class="mt-2 text-[12.5px] leading-relaxed text-muted">{{ $t('home.lastSession.never') }}</p>
    </section>

    <!-- Condensed changelog -->
    <section v-if="release" class="sw-panel flex-1 p-4">
      <div class="flex items-baseline justify-between">
        <span class="sw-eyebrow">{{ $t('home.changelog.title') }}</span>
        <span class="font-mono text-[11px] text-primary">v{{ release.version }}</span>
      </div>
      <ul class="mt-3 space-y-2">
        <li v-for="(item, i) in release.items" :key="i" class="flex gap-2.5 text-[12.5px] leading-snug text-toned">
          <span class="mt-[7px] size-1 shrink-0 rounded-full bg-primary" />
          {{ tr(item) }}
        </li>
      </ul>
    </section>
  </aside>
</template>

<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import type { Instance, PingResult, ServerInfo } from '~/types/launcher'
import { CHANGELOG } from '~/content/changelog'
import { FEATURED_SERVER } from '~/content/servers'

const props = defineProps<{ instance?: Instance }>()

const instances = useInstancesStore()
const { t, locale } = useI18n()
const tr = useLocalized()

const release = CHANGELOG[0]
const gradientId = `sw-spark-${useId()}`

/* ---------- last session ---------- */

const lastInstance = computed(() =>
  [...instances.instances]
    .filter(i => i.last_played)
    .sort((a, b) => (b.last_played ?? '').localeCompare(a.last_played ?? ''))[0],
)

/* ---------- server status ---------- */

interface Target { name: string, address: string, fromInstance?: string }

const instanceServer = ref<ServerInfo | null>(null)

watch(() => props.instance?.id, async (id) => {
  instanceServer.value = null
  if (!id) return
  const list = await invoke<ServerInfo[]>('list_servers', { id }).catch(() => [])
  if (props.instance?.id === id) instanceServer.value = list.find(s => !s.hidden && s.ip) ?? null
}, { immediate: true })

const server = computed<Target | null>(() => {
  if (instanceServer.value) {
    return { name: instanceServer.value.name, address: instanceServer.value.ip, fromInstance: props.instance?.name }
  }
  return FEATURED_SERVER.address ? { ...FEATURED_SERVER } : null
})

const ping = ref<PingResult | null>(null)
const status = ref<'checking' | 'online' | 'offline'>('checking')
/** Latency history for the sparkline, oldest first. */
const samples = ref<number[]>([])
const MAX_SAMPLES = 24
const INTERVAL_MS = 20_000

async function check() {
  const target = server.value
  if (!target || document.hidden) return
  const { host, port } = parseServerAddress(target.address)
  try {
    const result = await invoke<PingResult>('ping_server', { host, port: port ?? null })
    if (server.value?.address !== target.address) return
    ping.value = result
    status.value = 'online'
    samples.value = [...samples.value, result.latency_ms].slice(-MAX_SAMPLES)
  } catch {
    if (server.value?.address !== target.address) return
    status.value = 'offline'
  }
}

watch(() => server.value?.address, () => {
  ping.value = null
  samples.value = []
  status.value = 'checking'
  // A second quick sample so the graph has a line straight away
  check().then(() => setTimeout(check, 2500))
}, { immediate: true })

let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => { timer = setInterval(check, INTERVAL_MS) })
onBeforeUnmount(() => { if (timer) clearInterval(timer) })

const statusLabel = computed(() => t(`home.server.${status.value}`))
const statusClass = computed(() => ({
  checking: 'text-dimmed',
  online: 'text-[var(--sw-success)]',
  offline: 'text-[var(--sw-danger)]',
}[status.value]))

function latencyClass(ms: number) {
  if (ms < 80) return 'text-[var(--sw-success)]'
  if (ms < 200) return 'text-[var(--sw-warning)]'
  return 'text-[var(--sw-danger)]'
}

const sparkline = computed(() => {
  const v = samples.value
  const min = Math.min(...v)
  const range = Math.max(...v) - min || 1
  const pts = v.map((ms, i) => [
    (i / (v.length - 1)) * 120,
    4 + (1 - (ms - min) / range) * 24,
  ] as const)
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  return { line, area: `${line} L120 32 L0 32 Z` }
})
</script>
