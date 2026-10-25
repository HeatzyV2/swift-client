<template>
  <div class="h-full overflow-y-auto">
    <div class="sw-page">
      <UiPageHeader icon="i-lucide-server" :title="$t('servers.title')" :subtitle="$t('servers.subtitle')" />

      <div v-if="servers.length" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <section v-for="(entry, i) in servers" :key="entry.id" class="sw-server sw-rise-in" :style="{ animationDelay: `${i * 50}ms` }">
          <!-- Head: the server icon big, its name, the live state -->
          <div class="flex items-center gap-3.5">
            <img v-if="entry.ping?.favicon" :src="entry.ping.favicon" alt="" class="size-14 shrink-0 rounded-[12px] [image-rendering:pixelated] shadow-[0_6px_18px_rgb(0_0_0/0.35)]">
            <div v-else class="flex size-14 shrink-0 items-center justify-center rounded-[12px] bg-[var(--sw-surface-3)]">
              <UIcon name="i-lucide-server" class="size-6 text-dimmed" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-headline truncate text-[22px] font-extrabold! uppercase leading-none text-highlighted">{{ entry.name }}</p>
              <p class="mt-1 truncate font-mono text-[11.5px] text-dimmed">{{ entry.address }}</p>
            </div>
          </div>

          <p class="mt-3.5 line-clamp-2 min-h-[2.6em] text-[12.5px] leading-relaxed text-muted">
            {{ entry.ping ? stripFormatting(entry.ping.motd) : '' }}
          </p>

          <div class="mt-4 flex items-center gap-4 border-t border-[var(--sw-line)] pt-3.5">
            <span class="flex items-center gap-2 text-[12px] font-semibold" :class="statusClass(entry.status)">
              <span class="size-2 rounded-full bg-current shadow-[0_0_0_3px_color-mix(in_srgb,currentColor_22%,transparent)]" />
              {{ t(`home.server.${entry.status}`) }}
            </span>
            <span v-if="entry.ping" class="text-[13px] font-bold tabular-nums text-highlighted">
              {{ entry.ping.online.toLocaleString() }}<span class="font-medium text-dimmed"> / {{ entry.ping.max.toLocaleString() }}</span>
            </span>
            <span v-if="entry.ping" class="font-mono text-[11.5px] tabular-nums" :class="latencyClass(entry.ping.latency_ms)">{{ entry.ping.latency_ms }} ms</span>
          </div>

          <div class="mt-4 flex items-center gap-2">
            <UButton
              icon="i-lucide-play"
              :label="t('servers.join')"
              class="font-headline flex-1 justify-center text-[16px] font-extrabold! uppercase tracking-[0.04em]"
              :disabled="entry.status === 'offline'"
              :title="t('servers.joinHint', { name: entry.name })"
              @click="join(entry)"
            />
            <UTooltip :text="t('platform.copy')">
              <UButton color="neutral" variant="soft" icon="i-lucide-clipboard" square :aria-label="t('platform.copy')" @click="copyAddress(entry)" />
            </UTooltip>
            <UButton color="neutral" variant="soft" icon="i-lucide-arrow-up-right" square :aria-label="entry.address" @click="openExternal(`https://${entry.address}`)" />
          </div>
        </section>
      </div>

      <UiEmptyState v-else icon="i-lucide-server" :title="t('servers.empty')" :description="t('servers.emptyDesc')" />
    </div>
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

const platform = useSwiftPlatform()
const instances = useInstancesStore()
const launchFlow = useLaunchFlow()

/** Starts the player's Swift Client instance and connects to the server straight away. */
async function join(entry: ServerCard) {
  await instances.ensureLoaded()
  const swift = instances.instances.find(i => i.swift)
  if (!swift) {
    toast.add({ title: t('servers.joinNoInstance'), color: 'warning', icon: 'i-lucide-zap' })
    return
  }
  const { host, port } = parseServerAddress(entry.address)
  await launchFlow.play(swift.id, { kind: 'Multiplayer', host, port })
}

/** What the admin published; the list that ships with the launcher is only the fallback. */
const source = computed(() => {
  const live = platform.servers.value.filter(s => s.edition !== 'bedrock')
  if (live.length) {
    return live.map(s => ({ id: s.id, name: s.name, address: s.port && s.port !== 25565 ? `${s.address}:${s.port}` : s.address }))
  }
  return PARTNER_SERVERS.map(s => ({ id: s.id, name: s.name, address: s.address }))
})

const servers = ref<ServerCard[]>([])
watch(source, (list) => {
  servers.value = list.map(s => ({ ...s, status: 'checking' as const, ping: null }))
  servers.value.forEach(check)
}, { immediate: true })

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
  servers.value.forEach(check)
  timer = setInterval(() => servers.value.forEach(check), INTERVAL_MS)
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

<style scoped>
.sw-server {
  display: flex;
  flex-direction: column;
  padding: 18px;
  border-radius: 16px;
  border: 1px solid var(--sw-line);
  background:
    radial-gradient(80% 60% at 0% 0%, color-mix(in srgb, var(--sw-accent) 10%, transparent), transparent 70%),
    var(--sw-surface);
  transition: transform 180ms var(--ease-swift), border-color 180ms var(--ease-swift), box-shadow 180ms var(--ease-swift);
}
.sw-server:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--sw-accent) 35%, var(--sw-line));
  box-shadow: var(--shadow-md);
}
</style>
