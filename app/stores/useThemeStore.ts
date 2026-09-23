import { defineStore } from 'pinia'

/** Swift Client has one visual identity; the only choice is how dark the base is. */
export type ThemeMode = 'dark' | 'oled'

const STORAGE_KEY = 'swift-theme'

function loadMode(): ThemeMode {
  if (!import.meta.client) return 'dark'
  try {
    return localStorage.getItem(STORAGE_KEY) === 'oled' ? 'oled' : 'dark'
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
      document.documentElement.classList.toggle('oled', this.mode === 'oled')
    },

    setMode(mode: ThemeMode) {
      this.mode = mode
      if (import.meta.client) localStorage.setItem(STORAGE_KEY, mode)
      this.apply()
    },
  },
})
