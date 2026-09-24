export default defineI18nConfig(() => ({
  // Every locale carries every key; add new strings to all seven files.
  // English is only a safety net for a key that slips through.
  fallbackLocale: 'en',
  missingWarn: false,
  fallbackWarn: false,
}))
