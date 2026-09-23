/**
 * Home news, shipped with the launcher.
 *
 * There is no news service yet, so entries live here and change with each
 * release. Keep them factual: they describe this build of Swift Client. Images
 * go in `public/art/` (`node scripts/generate-art.mjs` makes the built-in ones).
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
}

export const NEWS: NewsItem[] = [
  {
    id: 'swift-0.1',
    date: '2026-09-23',
    image: '/art/news-release.svg',
    title: { en: 'Swift Client 0.1', fr: 'Swift Client 0.1' },
    summary: {
      en: 'The first release: a new launcher built around getting you into the game.',
      fr: 'Première version : un nouveau launcher pensé pour vous amener en jeu au plus vite.',
    },
    body: {
      en: 'Swift Client 0.1 brings a redesigned Home centred on your selected instance, a faster instance switcher, a library for all your installs, and support for Vanilla, Fabric, Quilt, Forge and NeoForge. Automatic updates are not available yet: new versions are installed manually for now.',
      fr: 'Swift Client 0.1 apporte un accueil repensé autour de votre instance sélectionnée, un sélecteur d’instance plus rapide, une bibliothèque pour toutes vos installations, et la prise en charge de Vanilla, Fabric, Quilt, Forge et NeoForge. Les mises à jour automatiques ne sont pas encore disponibles : les nouvelles versions s’installent manuellement pour l’instant.',
    },
  },
  {
    id: 'modrinth',
    date: '2026-09-23',
    image: '/art/news-modrinth.svg',
    title: { en: 'Modrinth, built in', fr: 'Modrinth, intégré' },
    summary: {
      en: 'Search and install mods, shaders, resource packs and modpacks without leaving the launcher.',
      fr: 'Cherchez et installez mods, shaders, packs de ressources et modpacks sans quitter le launcher.',
    },
    body: {
      en: 'Open an instance and choose Add to browse Modrinth. Dependencies are installed for you, updates are detected, and a restore point can be taken before every update so you can roll back if something breaks.',
      fr: 'Ouvrez une instance et choisissez Ajouter pour parcourir Modrinth. Les dépendances sont installées pour vous, les mises à jour sont détectées, et un point de restauration peut être créé avant chaque mise à jour pour revenir en arrière en cas de problème.',
    },
  },
  {
    id: 'privacy',
    date: '2026-09-23',
    image: '/art/news-privacy.svg',
    title: { en: 'No telemetry', fr: 'Zéro télémétrie' },
    summary: {
      en: 'Swift Client sends no analytics or crash data. Your games stay on your computer.',
      fr: 'Swift Client n’envoie ni statistiques ni rapports de crash. Vos parties restent sur votre ordinateur.',
    },
    body: {
      en: 'The launcher only talks to the services needed to play: Microsoft for sign-in, Mojang for game files, Modrinth for content and your mod loader’s servers. Logs are shared through mclo.gs only when you ask for it.',
      fr: 'Le launcher ne contacte que les services nécessaires pour jouer : Microsoft pour la connexion, Mojang pour les fichiers du jeu, Modrinth pour le contenu et les serveurs de votre mod loader. Les logs ne sont partagés via mclo.gs que si vous le demandez.',
    },
  },
]
