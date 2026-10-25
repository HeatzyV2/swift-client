<template>
  <section>
    <div class="mb-3 flex items-center justify-between gap-3">
      <h2 class="sw-eyebrow">{{ $t('home.partners') }}</h2>
      <NuxtLink to="/servers" class="sw-home-link">
        {{ $t('home.viewAll') }}
        <UIcon name="i-lucide-chevron-right" class="size-3.5" />
      </NuxtLink>
    </div>

    <ul v-if="servers.length" class="divide-y divide-[var(--sw-line)]">
      <li v-for="s in servers.slice(0, 4)" :key="s.id">
        <button
          type="button"
          class="group flex w-full items-center gap-3 py-3 text-left disabled:cursor-default"
          :disabled="!instances.selected"
          :title="instances.selected ? $t('home.joinOn', { name: instances.selected.name }) : undefined"
          @click="join(s)"
        >
          <img v-if="s.icon || pings[s.id]?.favicon" :src="s.icon || pings[s.id]!.favicon!" alt="" class="size-10 shrink-0 rounded-[8px] [image-rendering:pixelated]">
          <span v-else class="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-[var(--sw-surface-3)]">
            <UIcon name="i-lucide-server" class="size-5 text-dimmed" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[14px] font-bold uppercase text-highlighted transition-colors group-enabled:group-hover:text-primary">{{ s.name }}</span>
            <span class="block truncate text-[12px] text-dimmed">{{ s.address }}</span>
          </span>
          <span v-if="pings[s.id]" class="flex shrink-0 items-center gap-2 text-[14px] font-bold tabular-nums text-highlighted">
            <span class="size-2 rounded-full bg-[var(--sw-success)]" />
            {{ pings[s.id]!.online.toLocaleString(locale) }}
          </span>
          <span v-else-if="pings[s.id] === null" class="flex shrink-0 items-center gap-2 text-[12px] text-dimmed">
            <span class="size-2 rounded-full bg-[var(--sw-danger)]" />
            {{ $t('home.server.offline') }}
          </span>
          <span v-else class="h-3 w-6 shrink-0 animate-pulse rounded bg-[var(--sw-surface-3)]" />
        </button>
      </li>
    </ul>
    <p v-else class="sw-home-empty">
      <UIcon name="i-lucide-server" class="size-4 shrink-0 text-dimmed" />
      {{ $t('home.noPartners') }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import type { PingResult } from '~/types/launcher'
import { PARTNER_SERVERS } from '~/content/servers'

interface Row { id: string, name: string, address: string, host: string, port?: number, icon: string | null }

const instances = useInstancesStore()
const launchFlow = useLaunchFlow()
const platform = useSwiftPlatform()
const { locale } = useI18n()

/** Servers from the admin platform (featured first), else the partners bundled with the launcher. */
const servers = computed<Row[]>(() => {
  const remote = platform.servers.value
    .filter(s => s.edition !== 'bedrock')
    .sort((a, b) => Number(b.featured) - Number(a.featured))
  if (remote.length) {
    return remote.map(s => ({
      id: s.id,
      name: s.name,
      address: s.port && s.port !== 25565 ? `${s.address}:${s.port}` : s.address,
      host: s.address,
      port: s.port && s.port !== 25565 ? s.port : undefined,
      icon: s.iconUrl,
    }))
  }
  return PARTNER_SERVERS.map((s) => {
    const { host, port } = parseServerAddress(s.address)
    return { id: s.id, name: s.name, address: s.address, host, port: port ?? undefined, icon: null }
  })
})

/** Live status per server: a result, null when unreachable, missing while checking. */
const pings = ref<Record<string, PingResult | null>>({})

async function check() {
  if (document.hidden) return
  await Promise.all(servers.value.slice(0, 4).map(async (s) => {
    const result = await invoke<PingResult>('ping_server', { host: s.host, port: s.port ?? null }).catch(() => null)
    pings.value = { ...pings.value, [s.id]: result }
  }))
}

watch(() => servers.value.map(s => s.id).join(','), () => { void check() }, { immediate: true })

let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => { timer = setInterval(check, 60_000) })
onBeforeUnmount(() => { if (timer) clearInterval(timer) })

async function join(s: Row) {
  const inst = instances.selected
  if (!inst) return
  track('server_play_attempt', { serverId: s.id })
  const started = await launchFlow.play(inst.id, { kind: 'Multiplayer', host: s.host, port: s.port })
  if (started) track('server_launch', { serverId: s.id })
}
</script>
