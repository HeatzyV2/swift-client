<template>
  <div class="flex h-full min-h-0 flex-col px-8 py-7">
    <UiPageHeader :title="$t('servers.title')" :subtitle="$t('servers.subtitle')" />

    <div v-if="servers.length" class="min-h-0 flex-1 overflow-y-auto">
      <div class="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        <section v-for="entry in servers" :key="entry.id" class="sw-panel p-4">
          <div class="flex items-center justify-between gap-3">
            <span class="flex items-center gap-1.5 text-[11.5px] font-medium" :class="statusClass(entry.status)">
              <span class="size-1.5 rounded-full bg-current shadow-[0_0_0_3px_color-mix(in_srgb,currentColor_22%,transparent)]" />
              {{ t(`home.server.${entry.status}`) }}
            </span>
            <span v-if="entry.ping" class="font-mono text-[11px] tabular-nums" :class="latencyClass(entry.ping.latency_ms)">
              {{ entry.ping.latency_ms }} ms
            </span>
          </div>

          <div class="mt-3 flex items-center gap-3">
            <img v-if="entry.ping?.favicon" :src="entry.ping.favicon" alt="" class="size-10 shrink-0 rounded-lg [image-rendering:pixelated]">
            <div v-else class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--sw-surface-3)]">
              <UIcon name="i-lucide-server" class="size-5 text-dimmed" />
            </div>
            <div class="min-w-0">
              <p class="truncate font-display text-[15px] font-semibold text-highlighted">{{ entry.name }}</p>
              <p class="truncate font-mono text-[11px] text-dimmed">{{ entry.address }}</p>
            </div>
          </div>

          <p v-if="entry.ping" class="mt-3 line-clamp-2 text-[12px] leading-relaxed text-muted">
            {{ stripFormatting(entry.ping.motd) }}
          </p>

          <div class="mt-4 flex items-center justify-between gap-2">
            <p class="font-display text-[13px] font-semibold tabular-nums text-highlighted">
              {{ entry.ping ? t('server.players', { online: entry.ping.online, max: entry.ping.max }) : '—' }}
            </p>
            <div class="flex gap-1.5">
              <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-clipboard" square @click="copyAddress(entry)" />
              <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-arrow-up-right" square @click="openExternal(`https://${entry.address}`)" />
            </div>
          </div>
        </section>
      </div>
    </div>

    <UiEmptyState v-else icon="i-lucide-server-off" :title="t('servers.empty')" :description="t('servers.emptyDesc')" />
  </div>
</template>

<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import { PARTNER_SERVERS } from '~/content/servers'
import type { PingResult } from '~/types/launcher'

const { t } = useI18n()
const toast = useToast()

interface ServerCard {
  id: string
  name: string
  address: string
  status: 'checking' | 'online' | 'offline'
  ping: PingResult | null
}

const servers = reactive<ServerCard[]>(
  PARTNER_SERVERS.map(s => ({ id: s.id, name: s.name, address: s.address, status: 'checking' as const, ping: null })),
)

const INTERVAL_MS = 20_000

async function check(entry: ServerCard) {
  if (document.hidden) return
  const { host, port } = parseServerAddress(entry.address)
  try {
    const result = await invoke<PingResult>('ping_server', { host, port: port ?? null })
    entry.ping = result
    entry.status = 'online'
  } catch {
    entry.ping = null
    entry.status = 'offline'
  }
}

let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  servers.forEach(check)
  timer = setInterval(() => servers.forEach(check), INTERVAL_MS)
})
onBeforeUnmount(() => { if (timer) clearInterval(timer) })

function statusClass(status: ServerCard['status']) {
  return { checking: 'text-dimmed', online: 'text-[var(--sw-success)]', offline: 'text-[var(--sw-danger)]' }[status]
}

function latencyClass(ms: number) {
  if (ms < 80) return 'text-[var(--sw-success)]'
  if (ms < 200) return 'text-[var(--sw-warning)]'
  return 'text-[var(--sw-danger)]'
}

/** Strips legacy `§x` Minecraft formatting codes from a MOTD before display. */
function stripFormatting(text: string) {
  return text.replace(/§./g, '').trim()
}

async function copyAddress(entry: ServerCard) {
  try {
    await navigator.clipboard.writeText(entry.address)
    toast.add({ title: t('servers.copied'), color: 'success' })
  } catch (e) {
    toast.add({ title: errorText(e), color: 'error' })
  }
}
</script>
