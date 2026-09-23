/**
 * Swift Client brand constants. Every place that shows the product name reads
 * it from here.
 *
 * The logo lives in two places, kept in sync by hand:
 *  - `components/brand/Mark.vue` — the inline "S" symbol used in the UI
 *  - `src-tauri/icons/source/*.svg` — the sources for the app icon, favicon and
 *    `public/brand/` (regenerate with `pnpm tauri icon src-tauri/icons/source/app-icon.svg`)
 */
export const BRAND = {
  name: 'Swift Client',
  shortName: 'Swift',
  tagline: 'Minecraft, launched fast.',
} as const
