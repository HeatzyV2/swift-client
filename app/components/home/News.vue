<template>
  <section v-if="items.length">
    <div class="mb-4 flex items-baseline gap-2">
      <h2 class="font-display text-[20px] font-semibold tracking-tight text-highlighted">{{ $t('home.news') }}</h2>
      <span class="translate-y-[-2px] font-mono text-[12px] text-dimmed">{{ items.length }}</span>
    </div>

    <div class="grid gap-3.5" style="grid-template-columns: repeat(auto-fill, minmax(260px, 1fr))">
      <button
        v-for="(item, i) in items"
        :key="item.id"
        type="button"
        class="sw-rise-in group relative block aspect-[16/10] overflow-hidden rounded-[18px] border text-left transition-[transform,border-color,box-shadow] duration-200 ease-[var(--ease-swift)] hover:-translate-y-1"
        :class="isDiscord(item)
          ? 'border-[#5865F2]/40 shadow-[0_12px_32px_-16px_rgb(88_101_242/0.55)] hover:border-[#5865F2]/70'
          : 'border-white/[0.06] hover:border-white/20'"
        :style="{ animationDelay: `${120 + i * 55}ms` }"
        @click="select(item)"
      >
        <!-- Discord CTA card -->
        <template v-if="isDiscord(item)">
          <div class="absolute inset-0 bg-[linear-gradient(145deg,#5865F2_0%,#404EED_48%,#2c2f6e_100%)]" />
          <div class="absolute -right-6 -top-8 size-40 rounded-full bg-white/10 blur-2xl" />
          <div class="absolute inset-0 flex flex-col justify-between p-5">
            <p class="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/70">{{ formatDate(item.date) }}</p>
            <div>
              <div class="mb-3 flex size-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <UIcon name="i-simple-icons-discord" class="size-6 text-white" />
              </div>
              <p class="font-display text-[18px] font-semibold leading-snug text-white">{{ tr(item.title) }}</p>
              <p class="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-white/75">{{ tr(item.summary) }}</p>
            </div>
          </div>
        </template>

        <!-- Image news card -->
        <template v-else>
          <img
            :src="item.image"
            alt=""
            draggable="false"
            loading="lazy"
            class="absolute inset-0 size-full object-cover transition-[scale] duration-300 ease-[var(--ease-swift)] group-hover:scale-[1.05]"
          >
          <div class="absolute inset-0 bg-[linear-gradient(to_top,rgb(0_0_0/0.88)_0%,rgb(0_0_0/0.35)_45%,transparent_72%)]" />
          <div class="absolute inset-x-0 bottom-0 p-4">
            <p class="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/65">{{ formatDate(item.date) }}</p>
            <p class="mt-1.5 font-display text-[16px] font-semibold leading-snug text-white">{{ tr(item.title) }}</p>
            <p class="mt-1 line-clamp-2 text-[12px] leading-relaxed text-white/60">{{ tr(item.summary) }}</p>
          </div>
        </template>
      </button>
    </div>

    <UModal :open="!!open" :ui="{ content: 'max-w-xl overflow-hidden' }" @update:open="(v: boolean) => { if (!v) open = null }">
      <template #content>
        <article v-if="open">
          <img :src="open.image" alt="" class="aspect-[16/7] w-full object-cover">
          <div class="space-y-3 p-6">
            <p class="text-[11px] font-medium uppercase tracking-[0.1em] text-dimmed">{{ formatDate(open.date) }}</p>
            <h3 class="font-display text-2xl font-semibold text-highlighted">{{ tr(open.title) }}</h3>
            <p class="text-sm leading-relaxed text-toned">{{ tr(open.body) }}</p>
            <div class="flex justify-end gap-2 pt-2">
              <UButton v-if="open.url" color="neutral" variant="soft" trailing-icon="i-lucide-arrow-up-right" :label="$t('home.readMore')" @click="openExternal(open.url!)" />
              <UButton :label="$t('common.close')" @click="open = null" />
            </div>
          </div>
        </article>
      </template>
    </UModal>
  </section>
</template>

<script setup lang="ts">
import { NEWS, type NewsItem } from '~/content/news'

const tr = useLocalized()
const { locale } = useI18n()
const open = ref<NewsItem | null>(null)

const items = NEWS

function isDiscord(item: NewsItem) {
  return item.id === 'discord'
}

function select(item: NewsItem) {
  if (item.direct && item.url) openExternal(item.url).catch(() => {})
  else open.value = item
}

const formatDate = (iso: string) =>
  new Date(iso)
    .toLocaleDateString(locale.value, { day: 'numeric', month: 'long', year: 'numeric' })
    .toUpperCase()
</script>
