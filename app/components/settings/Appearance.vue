<template>
  <div>
    <SettingsGroup :title="t('settings.appearance.theme')" icon="i-lucide-palette" :description="t('settings.appearance.themeHint')">
      <!-- Every theme as a small launcher in its own colours -->
      <div class="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-3">
        <button
          v-for="opt in themeOptions"
          :key="opt.value"
          type="button"
          class="sw-theme"
          :class="{ 'is-active': theme.mode === opt.value }"
          :aria-pressed="theme.mode === opt.value"
          @click="theme.setMode(opt.value)"
        >
          <span class="sw-theme-preview" :style="{ background: `color-mix(in srgb, ${opt.swatch} 70%, #000)` }">
            <span class="sw-theme-rail" :style="{ background: `color-mix(in srgb, ${opt.swatch} 55%, #000)` }">
              <span class="size-2 rounded-[2px]" :style="{ background: opt.accent }" />
              <span v-for="n in 3" :key="n" class="size-2 rounded-[2px] bg-white/15" />
            </span>
            <span class="flex min-w-0 flex-1 flex-col gap-1.5 p-2">
              <span class="h-6 rounded-[4px]" :style="{ background: opt.swatch, boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.06)' }">
                <span class="mt-3.5 ml-1.5 block h-1.5 w-8 rounded-full" :style="{ background: opt.accent }" />
              </span>
              <span class="grid flex-1 grid-cols-2 gap-1">
                <span class="rounded-[3px]" :style="{ background: opt.swatch }" />
                <span class="rounded-[3px]" :style="{ background: opt.swatch }" />
              </span>
            </span>
          </span>
          <span class="flex items-center gap-2 px-3 py-2.5">
            <span class="size-2.5 shrink-0 rounded-full" :style="{ background: opt.accent, boxShadow: `0 0 8px ${opt.accent}` }" />
            <span class="min-w-0 flex-1 truncate text-[13px] font-semibold text-highlighted">{{ opt.label }}</span>
            <UIcon v-if="theme.mode === opt.value" name="i-lucide-check" class="size-4 shrink-0 text-primary" />
          </span>
        </button>
      </div>
    </SettingsGroup>

    <SettingsGroup :title="t('settings.language.title')" icon="i-lucide-languages" :description="t('settings.language.auto')">
      <div class="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2.5">
        <button
          v-for="loc in localeChoices"
          :key="loc.code"
          type="button"
          class="sw-option flex! items-center gap-3"
          :class="{ 'is-active': locale === loc.code }"
          @click="onLocaleChange(loc.code)"
        >
          <LocaleFlag :code="loc.code" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[13.5px] font-semibold text-highlighted">{{ loc.native }}</span>
            <span class="block truncate text-[11.5px] text-muted">{{ loc.name }}</span>
          </span>
          <span class="sw-option-dot" />
        </button>
      </div>
    </SettingsGroup>

    <SettingsGroup>
      <SettingsRow :label="t('swiftx.zip.settingLabel')" :description="t('swiftx.zip.settingDesc')">
        <template #icon>
          <span class="flex size-12 shrink-0 items-center justify-center rounded-[10px] bg-[var(--sw-surface-2)]">
            <BrandMascot class="h-10 w-auto" />
          </span>
        </template>
        <USwitch v-model="zipEnabled" />
      </SettingsRow>
    </SettingsGroup>
  </div>
</template>

<script setup lang="ts">
import { THEME_META, THEME_MODES } from '~/stores/useThemeStore'

/** Settings → Theme: the colour theme and the interface language. */
const { t, locale, setLocale } = useI18n()
const theme = useThemeStore()
const { enabled: zipEnabled } = useZipPrefs()

const themeOptions = computed(() =>
  THEME_MODES.map(value => ({
    value,
    label: t(`settings.appearance.themes.${value}`),
    ...THEME_META[value],
  })),
)

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

<style scoped>
.sw-theme {
  display: flex;
  min-width: 0;
  flex-direction: column;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid var(--sw-line);
  background: var(--sw-surface-2);
  text-align: left;
  transition: border-color 160ms var(--ease-swift), box-shadow 160ms var(--ease-swift), transform 160ms var(--ease-swift);
}
.sw-theme:hover {
  border-color: var(--sw-line-strong);
  transform: translateY(-2px);
}
.sw-theme.is-active {
  border-color: var(--sw-accent);
  box-shadow: 0 0 0 3px var(--sw-accent-soft);
}
.sw-theme-preview {
  display: flex;
  height: 78px;
  border-bottom: 1px solid var(--sw-line);
}
.sw-theme-rail {
  display: flex;
  width: 18px;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding-top: 8px;
}
</style>
