import type { Localized } from './news'

/**
 * The large visual card at the top of the Home side panel.
 *
 * Point it at something real: the built-in modpack browser, a web page, or a
 * Minecraft server (its live status is pinged from the launcher). Set it to
 * `null` to hide the card.
 */
export type FeaturedAction =
  | { type: 'modpacks' }
  | { type: 'url', url: string }
  | { type: 'server', name: string, address: string }

export interface FeaturedCard {
  image: string
  eyebrow: Localized
  title: Localized
  action: FeaturedAction
}

export const FEATURED: FeaturedCard | null = {
  image: '/art/feature-modpacks.svg',
  eyebrow: { en: 'Discover', fr: 'Découvrir' },
  title: { en: 'Install a modpack in one click', fr: 'Installez un modpack en un clic' },
  action: { type: 'modpacks' },
}
