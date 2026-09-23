<template>
  <section v-if="items.length">
    <div class="mb-4 flex items-baseline gap-2.5">
      <h2 class="font-display text-lg font-semibold text-highlighted">{{ $t('home.news') }}</h2>
      <span class="font-mono text-xs text-dimmed">{{ items.length }}</span>
    </div>

    <div class="grid gap-4" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))">
      <button
        v-for="(item, i) in items"
        :key="item.id"
        type="button"
        class="sw-rise-in group relative block aspect-[16/9] overflow-hidden rounded-2xl border border-white/[0.07] bg-[var(--sw-surface)] text-left transition-[transform,border-color] duration-200 ease-[var(--ease-swift)] hover:-translate-y-1 hover:border-white/20"
        :style="{ animationDelay: `${140 + i * 60}ms` }"
        @click="open = item"
      >
        <img
          :src="item.image"
          alt=""
          draggable="false"
          loading="lazy"
          class="absolute inset-0 size-full object-cover transition-[scale] duration-300 ease-[var(--ease-swift)] group-hover:scale-[1.05]"
        >
        <div class="absolute inset-0 bg-[linear-gradient(to_top,rgb(6_8_12/0.95)_0%,rgb(6_8_12/0.6)_38%,transparent_70%)]" />
        <div class="absolute inset-x-0 bottom-0 p-4">
          <p class="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/55">{{ formatDate(item.date) }}</p>
          <p class="mt-1 font-display text-[16px] font-semibold leading-snug text-white">{{ tr(item.title) }}</p>
          <p class="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-white/65">{{ tr(item.summary) }}</p>
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
const backend = useBackend()
const { locale } = useI18n()
const open = ref<NewsItem | null>(null)

// Items tied to a build capability (Discord) only show when it is available.
const items = computed(() => NEWS.filter(item => item.requires !== 'discord' || backend.discord.value))

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(locale.value, { day: 'numeric', month: 'long', year: 'numeric' })
</script>
