<template>
  <span class="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-[var(--sw-surface-3)]">
    <img
      v-if="src && !failed"
      :src="src"
      alt=""
      class="size-full [image-rendering:pixelated]"
      draggable="false"
      @error="failed = true"
    >
    <span v-else class="font-display text-xs font-bold text-toned">{{ initial }}</span>
  </span>
</template>

<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import type { Friend, FriendKind } from '~/types/social'
import type { PlayerSkin } from '~/types/launcher'

const props = defineProps<{
  friend?: Pick<Friend, 'username' | 'kind' | 'uuid'> | null
  username?: string
  kind?: FriendKind
  uuid?: string | null
}>()

const failed = ref(false)
const src = ref<string | null>(null)

const kind = computed(() => props.friend?.kind ?? props.kind ?? 'offline')
const uuid = computed(() => props.friend?.uuid ?? props.uuid ?? null)
const username = computed(() => props.friend?.username ?? props.username ?? '?')
const initial = computed(() => username.value.charAt(0).toUpperCase())

/** Same rule Minecraft used for Steve vs Alex on offline UUIDs. */
function prefersAlex(id: string): boolean {
  const hex = id.replace(/-/g, '')
  if (hex.length !== 32) return false
  const hilo = BigInt(`0x${hex.slice(0, 16)}`) ^ BigInt(`0x${hex.slice(16)}`)
  const hash = Number((hilo >> 32n) ^ (hilo & 0xffffffffn)) | 0
  return (hash & 1) === 1
}

const cache = new Map<string, Promise<string | null>>()

async function loadDefaultFace(id: string): Promise<string | null> {
  const key = `default:${prefersAlex(id) ? 'Alex' : 'Steve'}`
  const cached = cache.get(key)
  if (cached) return cached
  const task = (async () => {
    try {
      const list = await invoke<{ name: string, model: string, path: string | null, url: string | null }[]>('list_default_skins')
      const name = prefersAlex(id) ? 'Alex' : 'Steve'
      const skin = list.find(d => d.name === name) ?? list.find(d => d.name === 'Steve')
      if (!skin) return null
      const full = skin.path
        ? await invoke<string>('read_image_data_url', { path: skin.path })
        : await invoke<string>('fetch_skin_data_url', { url: skin.url })
      return await skinFace(full)
    } catch {
      return null
    }
  })()
  cache.set(key, task)
  return task
}

async function loadMicrosoftFace(id: string): Promise<string | null> {
  const key = `ms:${id}`
  const cached = cache.get(key)
  if (cached) return cached
  const task = (async () => {
    try {
      const ps = await invoke<PlayerSkin>('get_player_skin', { uuid: id })
      return await skinFace(ps.skin)
    } catch {
      return loadDefaultFace(id)
    }
  })()
  cache.set(key, task)
  return task
}

watch(
  () => [kind.value, uuid.value, username.value] as const,
  async ([k, id]) => {
    failed.value = false
    src.value = null
    if (!id) {
      // Offline without uuid — still pick Steve/Alex from username hash.
      const fake = `00000000-0000-0000-0000-${username.value.length.toString(16).padStart(12, '0')}`.slice(0, 36)
      src.value = await loadDefaultFace(fake)
      return
    }
    src.value = k === 'microsoft' ? await loadMicrosoftFace(id) : await loadDefaultFace(id)
  },
  { immediate: true },
)
</script>
