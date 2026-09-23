<template>
  <button
    type="button"
    class="group relative block h-[210px] w-full overflow-hidden rounded-2xl border border-[var(--sw-line)] text-left"
    @click="activate"
  >
    <img :src="card.image" alt="" draggable="false" class="absolute inset-0 size-full object-cover transition-transform duration-300 ease-[var(--ease-swift)] group-hover:scale-[1.04]">
    <div class="absolute inset-0 bg-[linear-gradient(to_top,rgb(7_8_11/0.92),rgb(7_8_11/0.2)_60%,transparent)]" />
    <div class="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5">
      <div class="min-w-0">
        <p class="sw-eyebrow !text-primary">{{ tr(card.eyebrow) }}</p>
        <p class="mt-1 font-display text-lg font-semibold leading-snug text-white">{{ tr(card.title) }}</p>
        <p v-if="card.action.type === 'server'" class="mt-1 flex items-center gap-2 text-xs text-white/65">
          <span class="size-1.5 rounded-full" :class="ping ? 'bg-[var(--sw-success)]' : 'bg-neutral-500'" />
          {{ ping ? $t('server.players', { online: ping.online, max: ping.max }) : $t('server.offline') }}
          <span class="font-mono">{{ card.action.address }}</span>
        </p>
      </div>
      <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors duration-150 group-hover:bg-primary">
        <UIcon name="i-lucide-arrow-up-right" class="size-4" />
      </span>
    </div>
  </button>
</template>

<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import type { FeaturedCard } from '~/content/home'
import type { PingResult } from '~/types/launcher'

const props = defineProps<{ card: FeaturedCard }>()

const tr = useLocalized()
const browser = useContentWindow()
const ping = ref<PingResult | null>(null)

onMounted(async () => {
  if (props.card.action.type !== 'server') return
  const { host, port } = parseServerAddress(props.card.action.address)
  ping.value = await invoke<PingResult>('ping_server', { host, port: port ?? null }).catch(() => null)
})

function activate() {
  const action = props.card.action
  if (action.type === 'modpacks') browser.open({ kind: 'modpack', mode: 'createModpack' })
  else if (action.type === 'url') openExternal(action.url).catch(() => {})
  else navigator.clipboard.writeText(action.address).catch(() => {})
}
</script>
