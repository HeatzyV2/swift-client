/**
 * Image behind the Home play area.
 *
 * Drop files in `public/images/hero/` and list them here.
 * Only the first entry is used as a static backdrop (no rotation).
 * `position` is the CSS object-position that keeps the interesting part of the
 * picture in frame when the hero is wide and short.
 */
export interface HeroBackground {
  src: string
  position?: string
}

export const HERO_BACKGROUNDS: HeroBackground[] = [
  { src: '/images/hero/bees.png', position: '50% 45%' },
]

/** Unused while a single backdrop is shown; kept for a future multi-bg mode. */
export const HERO_ROTATE_MS = 14_000

/** Shown when HERO_BACKGROUNDS is empty. */
export const HERO_FALLBACK: HeroBackground = { src: '/art/hero-default.svg' }
