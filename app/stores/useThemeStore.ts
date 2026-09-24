import { defineStore } from 'pinia'

/**
 * Visual themes for Swift Client. Swift is the brand theme and the default,
 * OLED its pure-black variant; the others are Minecraft dimensions and biomes.
 * Colours live in assets/css/main.css (`html.theme-<mode>`); THEME_META only
 * carries what the picker shows for themes that are not active yet.
 */
export type ThemeMode =
  | 'swift' | 'oled' | 'nether' | 'end' | 'warden' | 'plains'
  | 'ocean' | 'desert' | 'cherry' | 'lush' | 'frozen'

/** Picker order. `swatch` = surface colour, `accent` = primary accent (keep in sync with main.css). */
export const THEME_META: Record<ThemeMode, { swatch: string, accent: string }> = {
  swift: { swatch: '#111317', accent: '#2e7cff' },
  oled: { swatch: '#000000', accent: '#2e7cff' },
  nether: { swatch: '#2b120e', accent: '#e8590c' },
  end: { swatch: '#1c1329', accent: '#b983ff' },
  warden: { swatch: '#0d1a20', accent: '#4cc9c0' },
  plains: { swatch: '#1a2216', accent: '#7cb342' },
  ocean: { swatch: '#0d2a31', accent: '#3ab6b0' },
  desert: { swatch: '#2b2213', accent: '#e0a84c' },
  cherry: { swatch: '#241620', accent: '#f4a6c1' },
  lush: { swatch: '#152418', accent: '#5cd68a' },
  frozen: { swatch: '#132229', accent: '#8fd8f0' },
}

export const THEME_MODES = Object.keys(THEME_META) as ThemeMode[]

const DEFAULT_MODE: ThemeMode = 'swift'

/** Themes that no longer exist, mapped to their closest replacement. */
const LEGACY_MODES: Record<string, ThemeMode> = {
  dark: 'swift',
  ash: 'swift',
  midnight: 'swift',
  ember: 'nether',
  aurora: 'warden',
}

const STORAGE_KEY = 'swift-theme'

function isThemeMode(value: string | null): value is ThemeMode {
  return !!value && (THEME_MODES as string[]).includes(value)
}

function loadMode(): ThemeMode {
  if (!import.meta.client) return DEFAULT_MODE
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isThemeMode(stored)) return stored
    return (stored && LEGACY_MODES[stored]) || DEFAULT_MODE
  } catch {
    return DEFAULT_MODE
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
