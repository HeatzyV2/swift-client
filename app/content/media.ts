/**
 * Images behind the Home play area. They rotate with a crossfade.
 *
 * To change them, drop files in `public/images/hero/` and list them here.
 * `position` is the CSS object-position that keeps the interesting part of the
 * picture in frame when the hero is wide and short.
 */
export interface HeroBackground {
  src: string
  position?: string
}

export const HERO_BACKGROUNDS: HeroBackground[] = [
  { src: '/images/hero/village.png', position: '50% 35%' },
  { src: '/images/hero/bees.png', position: '50% 45%' },
  { src: '/images/hero/caves.jpg', position: '50% 40%' },
]

/** Time each background stays on screen. */
export const HERO_ROTATE_MS = 14_000

/** Shown when HERO_BACKGROUNDS is empty. */
export const HERO_FALLBACK: HeroBackground = { src: '/art/hero-default.svg' }

/** Worn by the player model when there is no real skin (no account, or an offline account without one). */
export const DEFAULT_SKIN = { src: '/skins/default.png', model: 'classic' as const }
