<template>
  <div>
    <section class="sw-settings-card mb-4">
      <h3 class="sw-eyebrow mb-4">{{ t('settings.appearance.theme') }}</h3>
      <div class="flex flex-col gap-5 sm:flex-row">
        <div class="flex min-w-0 flex-1 flex-col gap-1.5">
          <button
            v-for="opt in themeOptions"
            :key="opt.value"
            type="button"
            class="sw-choice"
            :class="{ 'is-active': theme.mode === opt.value }"
            @click="theme.setMode(opt.value)"
          >
            <span
              class="h-5 w-1.5 shrink-0 rounded-full"
              :style="{ background: opt.accent }"
            />
            <span class="min-w-0 flex-1 text-[13px] font-medium text-highlighted">{{ opt.label }}</span>
            <span
              class="size-3.5 shrink-0 rounded-full border border-white/15"
              :style="{ background: opt.swatch }"
            />
            <UIcon
              v-if="theme.mode === opt.value"
              name="i-lucide-check"
              class="size-4 shrink-0 text-highlighted"
            />
          </button>
        </div>

        <!-- Live mini preview -->
        <div
          class="relative hidden w-[220px] shrink-0 overflow-hidden rounded-xl border border-[var(--sw-line)] sm:block"
          :style="{ background: previewTokens.canvas }"
        >
          <div class="flex h-[168px]">
            <div
              class="flex w-8 flex-col items-center gap-2 border-r py-3"
              :style="{ background: previewTokens.stage, borderColor: previewTokens.line }"
            >
              <span v-for="n in 4" :key="n" class="size-3 rounded" :style="{ background: previewTokens.lineStrong }" />
              <span class="mt-auto size-3 rounded" :style="{ background: previewTokens.accent }" />
            </div>
            <div class="flex min-w-0 flex-1 flex-col p-2.5">
              <div
                class="mb-2 h-5 rounded-md"
                :style="{ background: previewTokens.surface }"
              />
              <div
                class="flex flex-1 overflow-hidden rounded-lg border"
                :style="{ background: previewTokens.surface, borderColor: previewTokens.line }"
              >
                <div class="w-14 border-r p-1.5" :style="{ borderColor: previewTokens.line, background: previewTokens.surface2 }">
                  <div class="mb-1 h-2 rounded" :style="{ background: previewTokens.accent }" />
                  <div v-for="n in 3" :key="n" class="mb-1 h-1.5 rounded" :style="{ background: previewTokens.lineStrong }" />
                </div>
                <div class="flex-1 space-y-1.5 p-2">
                  <div class="h-2 w-3/4 rounded" :style="{ background: previewTokens.lineStrong }" />
                  <div class="h-8 rounded-md" :style="{ background: previewTokens.surface3 }" />
                  <div class="h-2 w-1/2 rounded" :style="{ background: previewTokens.line }" />
                </div>
              </div>
            </div>
          </div>
          <p class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent px-3 pb-2.5 pt-6 text-[11px] text-white/70">
            {{ t('settings.appearance.preview') }}
          </p>
        </div>
      </div>
    </section>

    <section class="sw-settings-card mb-4">
      <h3 class="sw-eyebrow mb-4">{{ t('settings.language.title') }}</h3>
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          v-for="loc in localeChoices"
          :key="loc.code"
          type="button"
          class="sw-choice"
          :class="{ 'is-active': locale === loc.code }"
          @click="onLocaleChange(loc.code)"
        >
          <LocaleFlag :code="loc.code" />
          <span class="min-w-0 flex-1">
            <span class="block text-[13px] font-medium text-highlighted">{{ loc.native }}</span>
            <span class="block text-[11px] text-muted">{{ loc.name }}</span>
          </span>
          <UIcon
            v-if="locale === loc.code"
            name="i-lucide-check"
            class="size-4 shrink-0 text-highlighted"
          />
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { THEME_META, THEME_MODES } from '~/stores/useThemeStore'

/** Settings → Theme: the colour theme and the interface language. */
const { t, locale, setLocale } = useI18n()
const theme = useThemeStore()

const themeOptions = computed(() =>
  THEME_MODES.map(value => ({
    value,
    label: t(`settings.appearance.themes.${value}`),
    ...THEME_META[value],
  })),
)

/** The preview always shows the active theme, so it reads the live tokens. */
const previewTokens = {
  canvas: 'var(--sw-canvas)',
  stage: 'var(--sw-stage)',
  surface: 'var(--sw-surface)',
  surface2: 'var(--sw-surface-2)',
  surface3: 'var(--sw-surface-3)',
  line: 'var(--sw-line)',
  lineStrong: 'var(--sw-line-strong)',
  accent: 'var(--sw-accent)',
}

const LOCALE_META: Record<string, { native: string }> = {
  en: { native: 'English' },
  fr: { native: 'Français' },
  de: { native: 'Deutsch' },
  es: { native: 'Español' },
  pl: { native: 'Polski' },
  ru: { native: 'Русский' },
  zh: { native: '中文' },
}

const localeChoices = computed(() =>
  Object.entries(LOCALE_META).map(([code, meta]) => ({
    code,
    ...meta,
    name: t(`settings.language.names.${code}`),
  })),
)

const onLocaleChange = (code: string) => setLocale(code as 'en' | 'pl' | 'de' | 'es' | 'fr' | 'zh' | 'ru')
</script>
