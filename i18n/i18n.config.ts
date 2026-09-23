export default defineI18nConfig(() => ({
  // New Swift Client strings exist in English and French first; other languages
  // fall back to English until they are translated.
  fallbackLocale: 'en',
  missingWarn: false,
  fallbackWarn: false,
}))
