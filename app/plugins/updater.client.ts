/** Wait a little after start-up so the check never competes with loading the Home. */
const STARTUP_DELAY_MS = 8_000

/**
 * Looks for a launcher update once per start and offers it in a toast.
 * Failures stay silent here (offline, no release yet); Settings shows them.
 */
export default defineNuxtPlugin((nuxtApp) => {
  // Dev builds are never behind a release
  if (import.meta.dev) return

  nuxtApp.hook('app:mounted', () => {
    setTimeout(async () => {
      const updater = useUpdater()
      if (!(await updater.checkForUpdate({ silent: true }))) return

      const { t } = nuxtApp.$i18n as { t: (key: string, params?: Record<string, unknown>) => string }
      useToast().add({
        id: 'launcher-update',
        title: t('settings.about.updateAvailable', { version: updater.version.value }),
        description: t('settings.about.updatePrompt'),
        icon: 'i-lucide-download',
        color: 'primary',
        duration: 0,
        actions: [{
          label: t('settings.about.install'),
          color: 'primary',
          onClick: () => {
            if (updater.blocked.value) {
              useToast().add({ title: t('settings.about.updateBlocked'), color: 'warning', icon: 'i-lucide-gamepad-2' })
              return
            }
            updater.install().catch(e => useToast().add({ title: errorText(e), color: 'error' }))
          },
        }],
      })
    }, STARTUP_DELAY_MS)
  })
})
