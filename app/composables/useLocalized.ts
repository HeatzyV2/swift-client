import type { Localized } from '~/content/news'

/** Picks the string for the interface language from a `{ en, fr? }` value. */
export const useLocalized = () => {
  const { locale } = useI18n()
  return (value: Localized) => value[locale.value] ?? value.en
}
