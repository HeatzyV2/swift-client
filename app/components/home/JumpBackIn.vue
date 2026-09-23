<template>
  <section>
    <div class="mb-3 flex items-baseline justify-between">
      <h2 class="font-display text-[15px] font-semibold text-highlighted">{{ $t('home.jumpBackIn') }}</h2>
      <NuxtLink
        v-if="instance"
        :to="{ path: `/instance/${instance.id}`, query: { tab: 'worlds' } }"
        class="text-xs text-dimmed transition-colors hover:text-highlighted"
      >{{ $t('home.viewAll') }}</NuxtLink>
    </div>

    <div v-if="loading" class="space-y-2">
      <div v-for="n in 3" :key="n" class="sw-skeleton h-[52px]" />
    </div>

    <p v-else-if="!rows.length" class="rounded-xl border border-dashed border-[var(--sw-line)] px-4 py-5 text-[13px] leading-relaxed text-dimmed">
      {{ instance ? $t('home.jumpBackInEmpty') : $t('home.jumpBackInNoInstance') }}
    </p>

    <ul v-else class="space-y-1">
      <li v-for="row in rows" :key="row.key">
        <div class="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors duration-150 hover:bg-[var(--sw-surface)]">
          <div class="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--sw-surface-2)]">
            <img v-if="row.icon" :src="row.icon" alt="" class="size-full object-cover [image-rendering:pixelated]">
            <UIcon v-else :name="row.kind === 'world' ? 'i-lucide-globe' : 'i-lucide-server'" class="size-4 text-dimmed" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-[13px] font-medium text-highlighted">{{ row.name }}</p>
            <p class="truncate text-[11px] text-dimmed">{{ row.detail }}</p>
          </div>
          <UTooltip :text="canQuickPlay ? $t(row.kind === 'world' ? 'quickPlay.playWorld' : 'quickPlay.connectServer') : $t('home.quickPlayUnsupported')">
            <UButton
              icon="i-lucide-play"
              size="sm"
              color="neutral"
              variant="ghost"
              square
              :disabled="!canQuickPlay || busy"
              class="opacity-60 transition-opacity group-hover:opacity-100"
              :aria-label="$t('ctx.play')"
              @click="row.play()"
            />
          </UTooltip>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import type { Instance, ServerInfo, WorldInfo } from '~/types/launcher'

const props = defineProps<{ instance?: Instance }>()

const launchFlow = useLaunchFlow()
const activity = useActivityCenter()
const { t, locale } = useI18n()

const worlds = ref<WorldInfo[]>([])
const servers = ref<ServerInfo[]>([])
const loading = ref(false)

const canQuickPlay = computed(() => !!props.instance && supportsQuickPlay(props.instance.mc_version))
const busy = computed(() => !!props.instance && activity.list.value.some(a => a.instanceId === props.instance!.id))

watch(() => props.instance?.id, async (id) => {
  worlds.value = []
  servers.value = []
  if (!id) return
  loading.value = true
  const [w, s] = await Promise.all([
    invoke<WorldInfo[]>('list_worlds', { id }).catch(() => []),
    invoke<ServerInfo[]>('list_servers', { id }).catch(() => []),
  ])
  if (props.instance?.id !== id) return
  worlds.value = w
  servers.value = s.filter(x => !x.hidden)
  loading.value = false
}, { immediate: true })

const rows = computed(() => {
  const id = props.instance?.id
  if (!id) return []
  const recentWorlds = [...worlds.value]
    .sort((a, b) => (b.last_played ?? 0) - (a.last_played ?? 0))
    .slice(0, 3)
    .map(w => ({
      key: `w:${w.folder}`,
      kind: 'world' as const,
      name: w.name,
      icon: w.icon_path ? assetUrl(w.icon_path) : null,
      detail: [w.last_played ? formatRelative(new Date(w.last_played).toISOString(), locale.value) : null, w.game_mode ? t(`content.gameMode.${w.game_mode}`) : null].filter(Boolean).join(' · '),
      play: () => launchFlow.play(id, { kind: 'Singleplayer', world: w.folder }),
    }))
  const topServers = servers.value.slice(0, 2).map(s => ({
    key: `s:${s.ip}`,
    kind: 'server' as const,
    name: s.name || s.ip,
    icon: s.icon_path ? assetUrl(s.icon_path) : null,
    detail: s.ip,
    play: () => launchFlow.play(id, { kind: 'Multiplayer', ...parseServerAddress(s.ip) }),
  }))
  return [...recentWorlds, ...topServers]
})
</script>
