<template>
  <section>
    <div class="mb-3 flex items-center justify-between gap-3">
      <h2 class="sw-eyebrow">{{ $t('home.whatsNew') }}</h2>
      <button v-if="items.length" type="button" class="sw-home-link" @click="listOpen = true">
        {{ $t('home.allNews') }}
        <UIcon name="i-lucide-chevron-right" class="size-3.5" />
      </button>
    </div>

    <div v-if="items.length" class="grid grid-cols-2 gap-4">
      <button
        v-for="item in items.slice(0, 2)"
        :key="item.id"
        type="button"
        class="group relative flex min-h-[180px] flex-col justify-end overflow-hidden rounded-[14px] border border-[var(--sw-line)] p-5 text-left shadow-md transition-[transform,border-color] duration-200 ease-[var(--ease-swift)] hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--sw-accent)_40%,var(--sw-line))]"
        @click="select(item)"
      >
        <img
          :src="item.image"
          alt=""
          draggable="false"
          loading="lazy"
          class="absolute inset-0 size-full object-cover transition-[scale] duration-300 ease-[var(--ease-swift)] group-hover:scale-[1.04]"
        >
        <div class="absolute inset-0 bg-[linear-gradient(to_top,rgb(5_7_11/0.95)_0%,rgb(5_7_11/0.7)_55%,rgb(5_7_11/0.35)_100%)]" />
        <div class="relative">
          <p class="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">{{ item.tag ? tr(item.tag) : $t('home.newsTag') }}</p>
          <p class="font-headline mt-1.5 line-clamp-2 text-[clamp(22px,2.2vw,28px)] font-extrabold! uppercase leading-[1] text-white">{{ tr(item.title) }}</p>
          <p class="mt-2 flex items-baseline gap-3 text-[12.5px] text-white/70">
            <span class="min-w-0 flex-1 truncate">{{ tr(item.summary) }}</span>
            <span class="shrink-0 text-white/55">{{ formatRelative(item.date, locale) }}</span>
          </p>
        </div>
      </button>
    </div>
    <p v-else class="sw-home-empty">
      <UIcon name="i-lucide-newspaper" class="size-4 shrink-0 text-dimmed" />
      {{ $t('home.noNews') }}
    </p>

    <!-- Every story -->
    <UModal v-model:open="listOpen" :title="$t('home.whatsNew')" :ui="{ content: 'max-w-lg' }">
      <template #body>
        <ul class="-my-1 space-y-1">
          <li v-for="item in items" :key="item.id">
            <button type="button" class="flex w-full items-center gap-3 rounded-[10px] p-2 text-left transition-colors hover:bg-[var(--sw-surface-2)]" @click="listOpen = false; select(item)">
              <img :src="item.image" alt="" class="h-12 w-20 shrink-0 rounded-[8px] object-cover">
              <span class="min-w-0 flex-1">
                <span class="block text-[10.5px] font-bold uppercase tracking-[0.12em] text-primary">{{ item.tag ? tr(item.tag) : $t('home.newsTag') }}</span>
                <span class="font-headline block truncate text-[17px] uppercase text-highlighted">{{ tr(item.title) }}</span>
                <span class="block truncate text-[12px] text-dimmed">{{ tr(item.summary) }}</span>
              </span>
              <span class="shrink-0 text-[11.5px] text-dimmed">{{ formatRelative(item.date, locale) }}</span>
            </button>
          </li>
        </ul>
      </template>
    </UModal>

    <!-- One story -->
    <UModal :open="!!open" :ui="{ content: 'max-w-xl overflow-hidden' }" @update:open="(v: boolean) => { if (!v) open = null }">
      <template #content>
        <article v-if="open">
          <img :src="open.image" alt="" class="aspect-[16/7] w-full object-cover">
          <div class="space-y-3 p-6">
            <p class="text-[11px] font-medium uppercase tracking-[0.1em] text-dimmed">{{ formatDate(open.date) }}</p>
            <h3 class="font-display text-2xl font-semibold text-highlighted">{{ tr(open.title) }}</h3>
            <p class="text-sm leading-relaxed text-toned">{{ tr(open.body) }}</p>
            <div class="flex justify-end gap-2 pt-2">
              <UButton v-if="open.url" color="neutral" variant="soft" trailing-icon="i-lucide-corner-right-up" :label="$t('home.readMore')" @click="openExternal(open.url!)" />
              <UButton :label="$t('common.close')" @click="open = null" />
            </div>
          </div>
        </article>
      </template>
    </UModal>
  </section>
</template>

<script setup lang="ts">
import type { NewsItem } from '~/content/news'

const tr = useLocalized()
const { locale } = useI18n()
const open = ref<NewsItem | null>(null)
const listOpen = ref(false)

const { news } = useHomeContent()
/** Newest first, whatever order the backend sends. */
const items = computed(() => [...news.value].sort((a, b) => b.date.localeCompare(a.date)))

function select(item: NewsItem) {
  track('news_open', { newsId: item.id })
  if (item.direct && item.url) openExternal(item.url).catch(() => {})
  else open.value = item
}

const formatDate = (iso: string) =>
  new Date(iso)
    .toLocaleDateString(locale.value, { day: 'numeric', month: 'long', year: 'numeric' })
    .toUpperCase()
</script>
