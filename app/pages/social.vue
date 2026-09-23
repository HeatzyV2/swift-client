<template>
  <div class="flex h-full min-h-0 flex-col px-8 py-7">
    <UiPageHeader :title="$t('social.title')" :subtitle="subtitle">
      <UBadge
        :color="social.mode === 'remote' ? 'success' : 'neutral'"
        variant="subtle"
        :label="social.mode === 'remote' ? $t('social.modeRemote') : $t('social.modeLocal')"
      />
    </UiPageHeader>

    <p v-if="social.mode === 'local'" class="mb-4 rounded-xl border border-[var(--sw-line)] bg-[var(--sw-surface)] px-4 py-3 text-xs text-muted">
      {{ $t('social.localHint') }}
    </p>

    <div class="grid min-h-0 flex-1 gap-4 lg:grid-cols-[280px_1fr]">
      <!-- Friends -->
      <section class="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--sw-line)] bg-[var(--sw-surface)]">
        <div class="flex items-center justify-between gap-2 border-b border-[var(--sw-line)] px-4 py-3">
          <h2 class="text-sm font-semibold text-highlighted">{{ $t('social.friends') }}</h2>
          <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-refresh-cw" square :loading="social.loading" @click="social.refresh()" />
        </div>

        <form class="space-y-2 border-b border-[var(--sw-line)] p-3" @submit.prevent="addFriend">
          <UInput v-model="addName" :placeholder="$t('social.addPlaceholder')" class="w-full" maxlength="16" />
          <div class="flex gap-1.5">
            <button
              v-for="opt in kindOptions"
              :key="opt.value"
              type="button"
              class="flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors"
              :class="addKind === opt.value
                ? 'bg-[var(--sw-surface-3)] text-highlighted shadow-[inset_0_0_0_1px_var(--sw-line-strong)]'
                : 'text-muted hover:text-toned'"
              @click="addKind = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
          <UButton
            type="submit"
            icon="i-lucide-user-plus"
            size="sm"
            class="w-full justify-center"
            :loading="adding"
            :disabled="addName.trim().length < 3"
            :label="$t('social.add')"
          />
        </form>

        <div class="min-h-0 flex-1 overflow-y-auto p-2">
          <p v-if="!social.friends.length && !social.loading" class="px-2 py-8 text-center text-xs text-muted">
            {{ $t('social.noFriends') }}
          </p>
          <button
            v-for="f in social.friends"
            :key="f.id"
            type="button"
            class="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors"
            :class="activeFriendId === f.id ? 'bg-[var(--sw-surface-3)]' : 'hover:bg-[var(--sw-surface-2)]'"
            @click="openChat(f.id)"
          >
            <FriendAvatar :friend="f" class="size-9" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-medium text-highlighted">{{ f.username }}</span>
              <span class="block truncate text-[11px] text-dimmed">
                {{ f.kind === 'offline' ? $t('social.kindOffline') : $t('social.kindMicrosoft') }}
              </span>
            </span>
            <UButton
              icon="i-lucide-trash-2"
              size="xs"
              color="neutral"
              variant="ghost"
              square
              :aria-label="$t('common.remove')"
              @click.stop="removeFriend(f.id)"
            />
          </button>
        </div>
      </section>

      <!-- Chat -->
      <section class="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--sw-line)] bg-[var(--sw-surface)]">
        <template v-if="activeConv">
          <div class="flex items-center gap-3 border-b border-[var(--sw-line)] px-4 py-3">
            <FriendAvatar :friend="activeConv.friend" class="size-9" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold text-highlighted">{{ activeConv.friend.username }}</p>
              <p class="truncate text-[11px] text-dimmed">
                {{ activeConv.friend.kind === 'offline' ? $t('social.kindOffline') : $t('social.kindMicrosoft') }}
              </p>
            </div>
          </div>

          <div ref="scrollEl" class="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
            <p v-if="!(messages.length)" class="py-12 text-center text-xs text-muted">{{ $t('social.chatEmpty') }}</p>
            <div
              v-for="m in messages"
              :key="m.id"
              class="flex"
              :class="m.from === 'me' ? 'justify-end' : 'justify-start'"
            >
              <div
                class="max-w-[75%] space-y-1.5 rounded-2xl px-3.5 py-2.5"
                :class="m.from === 'me'
                  ? 'rounded-br-md bg-primary/20 text-highlighted'
                  : 'rounded-bl-md bg-[var(--sw-surface-3)] text-toned'"
              >
                <p v-if="m.text" class="whitespace-pre-wrap break-words text-sm">{{ m.text }}</p>
                <button
                  v-if="m.image"
                  type="button"
                  class="block overflow-hidden rounded-lg"
                  @click="previewImage(m.image)"
                >
                  <img
                    :src="imageSrc(m.image)"
                    alt=""
                    class="max-h-56 max-w-full object-contain"
                    loading="lazy"
                  >
                </button>
                <p class="text-[10px] text-dimmed">{{ formatTime(m.created_at) }}</p>
              </div>
            </div>
          </div>

          <div v-if="pendingImage" class="flex items-center gap-2 border-t border-[var(--sw-line)] px-4 py-2">
            <img :src="pendingPreview" alt="" class="size-12 rounded-md object-cover">
            <span class="min-w-0 flex-1 truncate text-xs text-muted">{{ pendingName }}</span>
            <UButton icon="i-lucide-x" size="xs" color="neutral" variant="ghost" square @click="clearPendingImage" />
          </div>

          <form class="flex items-end gap-2 border-t border-[var(--sw-line)] p-3" @submit.prevent="send">
            <UButton
              type="button"
              icon="i-lucide-image"
              color="neutral"
              variant="soft"
              square
              :aria-label="$t('social.attachImage')"
              @click="pickImage"
            />
            <UTextarea
              v-model="draft"
              :placeholder="$t('social.messagePlaceholder')"
              :rows="1"
              autoresize
              class="flex-1"
              @keydown.enter.exact.prevent="send"
            />
            <UButton
              type="submit"
              icon="i-lucide-send"
              :loading="sending"
              :disabled="!canSend"
              :aria-label="$t('social.send')"
            />
          </form>
        </template>

        <div v-else class="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <UIcon name="i-lucide-messages-square" class="size-12 text-neutral-600" />
          <p class="text-sm text-muted">{{ $t('social.pickFriend') }}</p>
        </div>
      </section>
    </div>

    <UModal v-model:open="previewOpen" :title="$t('social.imagePreview')">
      <template #body>
        <img v-if="previewSrc" :src="previewSrc" alt="" class="mx-auto max-h-[70vh] rounded-lg object-contain">
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import type { ConversationView } from '~/types/social'

const { t } = useI18n()
const social = useSocialStore()
const backend = useBackend()
const toast = useToast()

const addName = ref('')
const addKind = ref<'microsoft' | 'offline'>('microsoft')
const adding = ref(false)
const activeFriendId = ref<string | null>(null)
const activeConv = ref<ConversationView | null>(null)
const draft = ref('')
const sending = ref(false)
const pendingImage = ref<string | null>(null)
const pendingPreview = ref<string | null>(null)
const pendingName = ref('')
const scrollEl = ref<HTMLElement | null>(null)
const previewOpen = ref(false)
const previewSrc = ref<string | null>(null)
const imageCache = ref<Record<string, string>>({})

const kindOptions = computed(() => [
  { value: 'microsoft' as const, label: t('social.kindMicrosoft') },
  { value: 'offline' as const, label: t('social.kindOffline') },
])

const subtitle = computed(() =>
  social.mode === 'remote' ? t('social.subtitleRemote') : t('social.subtitleLocal'),
)

const messages = computed(() =>
  activeConv.value ? (social.messages[activeConv.value.id] ?? []) : [],
)

const canSend = computed(() =>
  !sending.value && (!!draft.value.trim() || !!pendingImage.value),
)

onMounted(() => {
  social.ensureLoaded()
  backend.refresh().then(() => social.refresh())
})

watch(messages, async () => {
  await nextTick()
  if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight
})

async function addFriend() {
  const name = addName.value.trim()
  if (name.length < 3 || adding.value) return
  adding.value = true
  try {
    const friend = await social.addFriend(name, addKind.value)
    addName.value = ''
    toast.add({ title: t('social.added', { name: friend.username }), color: 'success' })
    await openChat(friend.id)
  } catch (e) {
    toast.add({ title: errorText(e), color: 'error' })
  } finally {
    adding.value = false
  }
}

async function removeFriend(id: string) {
  try {
    await social.removeFriend(id)
    if (activeFriendId.value === id) {
      activeFriendId.value = null
      activeConv.value = null
    }
  } catch (e) {
    toast.add({ title: errorText(e), color: 'error' })
  }
}

async function openChat(friendId: string) {
  activeFriendId.value = friendId
  try {
    activeConv.value = await social.openConversation(friendId)
  } catch (e) {
    toast.add({ title: errorText(e), color: 'error' })
  }
}

async function pickImage() {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
  })
  if (typeof selected !== 'string') return
  pendingImage.value = selected
  pendingName.value = selected.split(/[/\\]/).pop() ?? 'image'
  try {
    pendingPreview.value = await invoke<string>('read_image_data_url', { path: selected })
  } catch {
    pendingPreview.value = null
  }
}

function clearPendingImage() {
  pendingImage.value = null
  pendingPreview.value = null
  pendingName.value = ''
}

async function send() {
  if (!activeConv.value || !canSend.value) return
  sending.value = true
  try {
    await social.sendMessage(activeConv.value.id, draft.value.trim() || null, pendingImage.value)
    draft.value = ''
    clearPendingImage()
  } catch (e) {
    toast.add({ title: errorText(e), color: 'error' })
  } finally {
    sending.value = false
  }
}

function imageSrc(pathOrUrl: string) {
  if (pathOrUrl.startsWith('http') || pathOrUrl.startsWith('data:')) return pathOrUrl
  return imageCache.value[pathOrUrl] ?? ''
}

watch(messages, async (list) => {
  for (const m of list) {
    if (!m.image || m.image.startsWith('http') || m.image.startsWith('data:') || imageCache.value[m.image]) continue
    try {
      const url = await invoke<string>('social_image_data_url', { path: m.image })
      imageCache.value = { ...imageCache.value, [m.image]: url }
    } catch { /* ignore */ }
  }
}, { immediate: true, deep: true })

async function previewImage(pathOrUrl: string) {
  if (pathOrUrl.startsWith('http') || pathOrUrl.startsWith('data:')) {
    previewSrc.value = pathOrUrl
  } else {
    previewSrc.value = imageCache.value[pathOrUrl]
      ?? await invoke<string>('social_image_data_url', { path: pathOrUrl }).catch(() => null)
  }
  previewOpen.value = !!previewSrc.value
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}
</script>
