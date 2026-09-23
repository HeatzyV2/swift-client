import { defineStore } from 'pinia'

/** Visual themes for Swift Client — base surfaces + accent character. */
export type ThemeMode = 'dark' | 'oled' | 'ash' | 'midnight' | 'ember' | 'aurora'

export const THEME_MODES: ThemeMode[] = ['dark', 'oled', 'ash', 'midnight', 'ember', 'aurora']

const STORAGE_KEY = 'swift-theme'

function isThemeMode(value: string | null): value is ThemeMode {
  return !!value && (THEME_MODES as string[]).includes(value)
}

function loadMode(): ThemeMode {
  if (!import.meta.client) return 'dark'
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isThemeMode(stored) ? stored : 'dark'
  } catch {
    return 'dark'
  }
}

export const useThemeStore = defineStore('theme', {
  state: () => ({ mode: loadMode() as ThemeMode }),
  actions: {
    apply() {
      if (!import.meta.client) return
      try {
        useColorMode().preference = 'dark'
      } catch {
        document.documentElement.classList.add('dark')
      }
      const root = document.documentElement
      root.classList.remove('oled', ...THEME_MODES.map(m => `theme-${m}`))
      root.classList.add(`theme-${this.mode}`)
      // Keep legacy `.oled` for any remaining selectors during transition
      if (this.mode === 'oled') root.classList.add('oled')
      root.dataset.swTheme = this.mode
    },

    setMode(mode: ThemeMode) {
      this.mode = mode
      if (import.meta.client) localStorage.setItem(STORAGE_KEY, mode)
      this.apply()
    },
  },
})
