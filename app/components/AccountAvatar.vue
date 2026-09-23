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
    <span v-else-if="account" class="font-display text-xs font-bold text-toned">{{ account.username.charAt(0).toUpperCase() }}</span>
    <UIcon v-else name="i-lucide-user-round" class="size-4 text-dimmed" />
  </span>
</template>

<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import type { Account, PlayerSkin } from '~/types/launcher'

const faceByUuid = new Map<string, Promise<string | null>>()

function loadProfileFace(uuid: string): Promise<string | null> {
  const cached = faceByUuid.get(uuid)
  if (cached) return cached
  const task = (async () => {
    try {
      const ps = await invoke<PlayerSkin>('get_player_skin', { uuid })
      return await skinFace(ps.skin)
    } catch {
      return null
    }
  })()
  faceByUuid.set(uuid, task)
  return task
}

/** Prefer an explicit `face`; otherwise load the Microsoft profile skin (never Steve/Alex defaults). */
const props = defineProps<{ account?: Account | null, face?: string | null }>()
const failed = ref(false)
const profileFace = ref<string | null>(null)

watch(
  () => [props.face, props.account?.kind, props.account?.uuid] as const,
  async ([face, kind, uuid]) => {
    failed.value = false
    profileFace.value = null
    if (face || kind !== 'microsoft' || !uuid) return
    const result = await loadProfileFace(uuid)
    if (props.account?.uuid === uuid) profileFace.value = result
  },
  { immediate: true },
)

const src = computed(() => props.face || profileFace.value)

watch(src, () => { failed.value = false })
</script>
