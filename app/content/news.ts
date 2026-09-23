import { LINKS } from './links'

/**
 * Home news, shipped with the launcher.
 *
 * There is no news service yet, so entries live here and change with each
 * release. Keep them factual. Put images in `public/images/news/` — each item
 * should have its own. An empty list hides the section entirely.
 * When a Swift backend exists, `components/home/News.vue` is where to swap the source.
 */

/** A string per interface language; English is required and used as the fallback. */
export type Localized = { en: string } & Partial<Record<string, string>>

export interface NewsItem {
  id: string
  /** ISO date, shown in the interface language. */
  date: string
  image: string
  title: Localized
  summary: Localized
  body: Localized
  /** Optional link opened from the article. */
  url?: string
  /** Open `url` straight away instead of showing the article. */
  direct?: boolean
}

export const NEWS: NewsItem[] = [
  {
    id: 'swift-0.1',
    date: '2026-09-23',
    image: '/images/news/coral-reef.png',
    title: { en: 'Swift Client 0.1', fr: 'Swift Client 0.1' },
    summary: {
      en: 'The first release, built around getting you into the game.',
      fr: 'La première version, pensée pour vous amener en jeu au plus vite.',
    },
    body: {
      en: 'Swift Client 0.1 brings a Home centred on your selected instance, a quick instance switcher, a library for all your installs, and support for Vanilla, Fabric, Quilt, Forge and NeoForge. Automatic updates are not available yet: new versions are installed manually for now.',
      fr: 'Swift Client 0.1 apporte un accueil centré sur votre instance sélectionnée, un sélecteur d’instance rapide, une bibliothèque pour toutes vos installations, et la prise en charge de Vanilla, Fabric, Quilt, Forge et NeoForge. Les mises à jour automatiques ne sont pas encore disponibles : les nouvelles versions s’installent manuellement pour l’instant.',
    },
  },
  {
    id: 'modrinth',
    date: '2026-09-23',
    image: '/images/hero/caves.jpg',
    title: { en: 'Modrinth, built in', fr: 'Modrinth intégré' },
    summary: {
      en: 'Mods, shaders, resource packs and modpacks without leaving the launcher.',
      fr: 'Mods, shaders, packs de ressources et modpacks sans quitter le launcher.',
    },
    body: {
      en: 'Open an instance and choose Add to browse Modrinth. Dependencies are installed for you, updates are detected, and a restore point can be taken before every update so you can roll back if something breaks.',
      fr: 'Ouvrez une instance et choisissez Ajouter pour parcourir Modrinth. Les dépendances sont installées pour vous, les mises à jour sont détectées, et un point de restauration peut être créé avant chaque mise à jour pour revenir en arrière en cas de problème.',
    },
  },
  // Shown once LINKS.discord (content/links.ts) holds the invite.
  ...(LINKS.discord
    ? [{
        id: 'discord',
        date: '2026-09-23',
        image: '/images/news/discord.jpg',
        url: LINKS.discord,
        direct: true,
        title: { en: 'Join the Discord', fr: 'Rejoindre le Discord' },
        summary: {
          en: 'News and help: join the Swift Client community.',
          fr: 'Nouveautés et entraide : rejoignez la communauté Swift Client.',
        },
        body: { en: '', fr: '' },
      } satisfies NewsItem]
    : []),
]
