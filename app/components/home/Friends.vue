<template>
  <section>
    <div class="mb-3 flex items-center justify-between gap-3">
      <h2 class="sw-eyebrow">
        {{ $t('home.friends.title') }}
        <span v-if="friends.length" class="ml-1 text-muted">· {{ friends.length }}</span>
      </h2>
      <NuxtLink to="/social" class="sw-home-link">
        {{ $t('home.viewAll') }}
        <UIcon name="i-lucide-chevron-right" class="size-3.5" />
      </NuxtLink>
    </div>

    <!-- Incoming requests -->
    <template v-if="requests.length">
      <p class="sw-eyebrow mb-1.5 text-[10.5px]">{{ $t('home.friends.requests', { n: requests.length }) }}</p>
      <ul class="mb-4">
        <li v-for="f in requests.slice(0, 3)" :key="f.id" class="flex items-center gap-3 py-2">
          <FriendAvatar :friend="f" class="size-10 rounded-[8px]" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[14px] font-bold text-highlighted">{{ f.username }}</span>
            <span class="block truncate text-[12px] text-dimmed">
              {{ $t('home.friends.wantsToBeFriends') }}<template v-if="ago(f.created_at)"> · {{ ago(f.created_at) }}</template>
            </span>
          </span>
          <UButton icon="i-lucide-check" size="md" square :loading="busy === f.id" :aria-label="$t('home.friends.accept')" @click="answer(f.id, true)" />
          <UButton icon="i-lucide-x" size="md" color="neutral" variant="outline" square :disabled="busy === f.id" :aria-label="$t('home.friends.decline')" @click="answer(f.id, false)" />
        </li>
      </ul>
    </template>

    <!-- Friends. The launcher does not know who is online yet, so there is no presence or Join here. -->
    <ul v-if="friends.length" class="divide-y divide-[var(--sw-line)]">
      <li v-for="f in friends.slice(0, 4)" :key="f.id">
        <NuxtLink to="/social" class="group flex items-center gap-3 py-2.5">
          <FriendAvatar :friend="f" class="size-10 rounded-[8px]" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[14px] font-bold text-highlighted">{{ f.username }}</span>
            <span class="block truncate text-[12px] text-dimmed">{{ $t(f.kind === 'microsoft' ? 'social.kindMicrosoft' : 'social.kindOffline') }}</span>
          </span>
          <span class="flex size-9 shrink-0 items-center justify-center rounded-[8px] border border-[var(--sw-line-strong)] text-muted transition-colors group-hover:border-[color-mix(in_srgb,var(--sw-accent)_45%,var(--sw-line-strong))] group-hover:text-highlighted">
            <UIcon name="i-lucide-message-circle" class="size-4" />
          </span>
        </NuxtLink>
      </li>
    </ul>
    <p v-else-if="social.loaded && !requests.length" class="sw-home-empty">
      <UIcon name="i-lucide-user-plus" class="size-4 shrink-0 text-dimmed" />
      <span>
        {{ $t('home.friends.empty') }}
        <NuxtLink to="/social" class="font-semibold text-primary hover:underline">{{ $t('social.add') }}</NuxtLink>
      </span>
    </p>
  </section>
</template>

<script setup lang="ts">
const social = useSocialStore()
const toast = useToast()
const { locale } = useI18n()

const friends = computed(() => social.friends.filter(f => f.status === 'accepted'))
const requests = computed(() => social.friends.filter(f => f.status === 'pending_in'))
const busy = ref<string | null>(null)

const ago = (iso: string) => formatRelative(iso, locale.value)

async function answer(id: string, accept: boolean) {
  busy.value = id
  try {
    await (accept ? social.acceptFriend(id) : social.declineFriend(id))
  } catch (e) {
    toast.add({ title: errorText(e), color: 'error' })
  } finally {
    busy.value = null
  }
}

onMounted(() => social.ensureLoaded())
</script>
