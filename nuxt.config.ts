export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  // Devtools can race Vite dep re-optimization in Tauri WebView and leave a blank window.
  devtools: { enabled: false },
  ssr: false,
  // WebView2 on Windows often resolves localhost to IPv4 while Nuxt may bind ::1 only.
  devServer: {
    host: '127.0.0.1',
    port: 3000,
  },
  app: {
    head: {
    }
  },

  vite: {
    clearScreen: false,
    server: {
      host: '127.0.0.1',
      strictPort: true,
      watch: {
        ignored: ['**/src-tauri/**'],
      },
      // Keep HMR on the same host/port as the page — 0.0.0.0:3001 breaks WebView2.
      hmr: {
        protocol: 'ws',
        host: '127.0.0.1',
        port: 3000,
        clientPort: 3000,
      },
    },
    envPrefix: ['VITE_', 'TAURI_'],
    optimizeDeps: {
      include: [
        'vue-draggable-plus',
        '@vue/devtools-core',
        '@vue/devtools-kit',
        '@tauri-apps/api',
        '@tauri-apps/api/core',
        '@tauri-apps/api/event',
        '@tauri-apps/api/app',
        '@tauri-apps/api/window',
        '@tauri-apps/plugin-os',
        '@tauri-apps/plugin-process',
        '@tauri-apps/plugin-updater',
      ],
    },
  },

  nitro: {
    static: true,
    ignore: ['src-tauri/**']
  },

  icon: {
    clientBundle: {
      scan: true,
      includeCustomCollections: true,
      sizeLimitKb: 512,
    },
    fallbackToApi: false,
  },

  css: ['~/assets/css/main.css'],

  modules: [
    '@pinia/nuxt',
    '@nuxt/ui',
    '@nuxtjs/i18n',
  ],

  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'en',
    lazy: true,
    locales: [
      { code: 'en', name: 'English', file: 'en.json' },
      { code: 'pl', name: 'Polski', file: 'pl.json' },
      { code: 'de', name: 'Deutsch', file: 'de.json' },
      { code: 'es', name: 'Español', file: 'es.json' },
      { code: 'fr', name: 'Français', file: 'fr.json' },
      { code: 'zh', name: '中文', file: 'zh.json' },
      { code: 'ru', name: 'Русский', file: 'ru.json' },
    ],

    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'spectra_locale',
      fallbackLocale: 'en',
      alwaysRedirect: false,
    },
  },
})
