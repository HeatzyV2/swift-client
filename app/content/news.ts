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
  /** Only show the item when this build capability is available. */
  requires?: 'discord'
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
  {
    id: 'discord-presence',
    date: '2026-09-23',
    image: '/images/news/discord.jpg',
    requires: 'discord',
    title: { en: 'Discord Rich Presence', fr: 'Statut Discord' },
    summary: {
      en: 'Show friends which instance you are playing, right on your Discord profile.',
      fr: 'Montrez à vos amis l’instance à laquelle vous jouez, directement sur votre profil Discord.',
    },
    body: {
      en: 'While a game is running, Swift Client can show the instance name and Minecraft version on your Discord profile. Discord has to be open on this computer. Turn it on or off in Settings → Privacy.',
      fr: 'Pendant une partie, Swift Client peut afficher le nom de l’instance et la version de Minecraft sur votre profil Discord. Discord doit être ouvert sur cet ordinateur. Activez-le ou désactivez-le dans Paramètres → Confidentialité.',
    },
  },
]
