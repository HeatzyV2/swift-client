<template>
  <section v-if="items.length">
    <div class="mb-4 flex items-baseline gap-2">
      <h2 class="font-display text-[20px] font-semibold tracking-tight text-highlighted">{{ $t('home.news') }}</h2>
      <span class="translate-y-[-2px] font-mono text-[12px] text-dimmed">{{ items.length }}</span>
    </div>

    <!-- Asymmetric: one featured story, the others stacked beside it -->
    <div class="sw-news-grid" :data-count="Math.min(items.length, 3)">
      <button
        v-for="(item, i) in items.slice(0, 3)"
        :key="item.id"
        type="button"
        class="sw-rise-in group relative block overflow-hidden rounded-[18px] border text-left transition-[transform,border-color,box-shadow] duration-200 ease-[var(--ease-swift)] hover:-translate-y-1"
        :class="[i === 0 ? 'sw-news-featured' : 'sw-news-small', isDiscord(item)
          ? 'border-[#5865F2]/40 shadow-[0_12px_32px_-16px_rgb(88_101_242/0.55)] hover:border-[#5865F2]/70'
          : 'border-white/[0.06] hover:border-white/20']"
        :style="{ animationDelay: `${120 + i * 55}ms` }"
        @click="select(item)"
      >
        <!-- Discord CTA card -->
        <template v-if="isDiscord(item)">
          <div class="absolute inset-0 bg-[linear-gradient(145deg,#5865F2_0%,#404EED_48%,#2c2f6e_100%)]" />
          <div class="absolute -right-6 -top-8 size-40 rounded-full bg-white/10 blur-2xl" />
          <div class="absolute inset-0 flex flex-col justify-between" :class="i === 0 ? 'p-6' : 'p-4'">
            <p class="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/70">{{ formatDate(item.date) }}</p>
            <div>
              <div class="flex size-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm" :class="i === 0 ? 'mb-3' : 'mb-2'">
                <UIcon name="i-simple-icons-discord" class="size-6 text-white" />
              </div>
              <p class="font-display text-[18px] font-semibold leading-snug text-white">{{ tr(item.title) }}</p>
              <p class="mt-1 text-[12.5px] leading-relaxed text-white/75" :class="i === 0 ? 'line-clamp-2' : 'line-clamp-1'">{{ tr(item.summary) }}</p>
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
          <div class="absolute inset-x-0 bottom-0" :class="i === 0 ? 'p-6' : 'p-4'">
            <p class="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/65">
              <span v-if="i === 0" class="sw-on-accent rounded-full bg-primary px-2 py-0.5 text-[10px] tracking-[0.1em]">{{ $t('home.featured') }}</span>
              {{ formatDate(item.date) }}
            </p>
            <p class="mt-1.5 font-display font-semibold leading-snug text-white" :class="i === 0 ? 'text-[26px] tracking-tight' : 'text-[16px]'">{{ tr(item.title) }}</p>
            <p class="mt-1 line-clamp-2 leading-relaxed text-white/65" :class="i === 0 ? 'max-w-[46ch] text-[13.5px]' : 'text-[12px]'">{{ tr(item.summary) }}</p>
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

<style scoped>
.sw-news-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: 1fr;
}
.sw-news-featured {
  aspect-ratio: 16 / 9;
}
.sw-news-small {
  aspect-ratio: 16 / 7;
}

/* Side by side once there is room: the featured card spans both rows */
@media (min-width: 900px) {
  .sw-news-grid:not([data-count='1']) {
    grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr);
    grid-auto-rows: minmax(150px, auto);
  }
  .sw-news-grid[data-count='3'] .sw-news-featured {
    grid-row: span 2;
  }
  .sw-news-grid:not([data-count='1']) .sw-news-featured {
    aspect-ratio: auto;
    min-height: 340px;
  }
  .sw-news-grid:not([data-count='1']) .sw-news-small {
    aspect-ratio: auto;
  }
  .sw-news-grid[data-count='1'] .sw-news-featured {
    aspect-ratio: 21 / 8;
  }
}
</style>
