/**
 * Starts the Swift Platform client once the app is up: bootstrap (announcements, maintenance, home
 * sections, servers, flags) and telemetry. Skipped in the secondary content window.
 */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:mounted', () => {
    if (window.location.pathname.startsWith('/browser')) return
    // Let the Home paint first
    setTimeout(() => { void nuxtApp.runWithContext(() => useSwiftPlatform().start()) }, 600)
  })
})
