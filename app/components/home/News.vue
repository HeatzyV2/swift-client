<template>
  <section v-if="NEWS.length">
    <div class="mb-4 flex items-baseline gap-2.5">
      <h2 class="font-display text-lg font-semibold text-highlighted">{{ $t('home.news') }}</h2>
      <span class="font-mono text-xs text-dimmed">{{ NEWS.length }}</span>
    </div>

    <div class="grid gap-4" style="grid-template-columns: repeat(auto-fill, minmax(250px, 1fr))">
      <button
        v-for="(item, i) in NEWS"
        :key="item.id"
        type="button"
        class="sw-rise-in group flex flex-col overflow-hidden rounded-2xl border border-[var(--sw-line)] bg-[var(--sw-surface)] text-left transition-[border-color,transform] duration-200 ease-[var(--ease-swift)] hover:-translate-y-0.5 hover:border-[var(--sw-line-strong)]"
        :style="{ animationDelay: `${120 + i * 50}ms` }"
        @click="open = item"
      >
        <div class="relative aspect-[16/8] overflow-hidden">
          <img :src="item.image" alt="" draggable="false" class="size-full object-cover transition-transform duration-300 ease-[var(--ease-swift)] group-hover:scale-[1.05]">
        </div>
        <div class="flex flex-1 flex-col gap-1.5 p-4">
          <span class="text-[11px] font-medium uppercase tracking-[0.1em] text-dimmed">{{ formatDate(item.date) }}</span>
          <span class="font-display text-[15px] font-semibold leading-snug text-highlighted">{{ tr(item.title) }}</span>
          <span class="line-clamp-2 text-[13px] leading-relaxed text-muted">{{ tr(item.summary) }}</span>
        </div>
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

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(locale.value, { day: 'numeric', month: 'long', year: 'numeric' })
</script>
