import { LINKS } from './links'

/**
 * Home news, shipped with the launcher. Give every entry all interface languages.
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
    title: { en: 'Swift Client 0.1', fr: 'Swift Client 0.1', de: 'Swift Client 0.1', es: 'Swift Client 0.1', pl: 'Swift Client 0.1', ru: 'Swift Client 0.1', zh: 'Swift Client 0.1' },
    summary: {
      en: 'The first release, built around getting you into the game.',
      fr: 'La première version, pensée pour vous amener en jeu au plus vite.',
      de: 'Die erste Version – gebaut, um dich so schnell wie möglich ins Spiel zu bringen.',
      es: 'La primera versión, pensada para llevarte al juego cuanto antes.',
      pl: 'Pierwsza wersja, stworzona, by jak najszybciej przenieść cię do gry.',
      ru: 'Первая версия, созданная, чтобы как можно быстрее отправить вас в игру.',
      zh: '第一个版本，只为让你尽快进入游戏。',
    },
    body: {
      en: 'Swift Client 0.1 brings a Home centred on your selected instance, a quick instance switcher, a library for all your installs, and support for Vanilla, Fabric, Quilt, Forge and NeoForge. Automatic updates are not available yet: new versions are installed manually for now.',
      fr: 'Swift Client 0.1 apporte un accueil centré sur votre instance sélectionnée, un sélecteur d’instance rapide, une bibliothèque pour toutes vos installations, et la prise en charge de Vanilla, Fabric, Quilt, Forge et NeoForge. Les mises à jour automatiques ne sont pas encore disponibles : les nouvelles versions s’installent manuellement pour l’instant.',
      de: 'Swift Client 0.1 bringt eine Startseite rund um deine ausgewählte Instanz, einen schnellen Instanzwechsler, eine Bibliothek für alle deine Installationen und Unterstützung für Vanilla, Fabric, Quilt, Forge und NeoForge. Automatische Updates gibt es noch nicht: Neue Versionen werden vorerst manuell installiert.',
      es: 'Swift Client 0.1 trae un Inicio centrado en tu instancia seleccionada, un selector de instancias rápido, una biblioteca para todas tus instalaciones y compatibilidad con Vanilla, Fabric, Quilt, Forge y NeoForge. Las actualizaciones automáticas aún no están disponibles: por ahora las nuevas versiones se instalan a mano.',
      pl: 'Swift Client 0.1 wprowadza stronę główną skupioną na wybranej instancji, szybki przełącznik instancji, bibliotekę wszystkich instalacji oraz obsługę Vanilla, Fabric, Quilt, Forge i NeoForge. Automatyczne aktualizacje nie są jeszcze dostępne: na razie nowe wersje instaluje się ręcznie.',
      ru: 'Swift Client 0.1 — это главная страница вокруг выбранного профиля, быстрый переключатель профилей, библиотека всех ваших установок и поддержка Vanilla, Fabric, Quilt, Forge и NeoForge. Автообновления пока нет: новые версии устанавливаются вручную.',
      zh: 'Swift Client 0.1 带来以所选实例为中心的主页、快速实例切换器、管理所有安装的库，并支持 Vanilla、Fabric、Quilt、Forge 和 NeoForge。暂不支持自动更新：新版本目前需要手动安装。',
    },
  },
  {
    id: 'modrinth',
    date: '2026-09-23',
    image: '/images/hero/caves.jpg',
    title: { en: 'Modrinth, built in', fr: 'Modrinth intégré', de: 'Modrinth integriert', es: 'Modrinth integrado', pl: 'Wbudowany Modrinth', ru: 'Встроенный Modrinth', zh: '内置 Modrinth' },
    summary: {
      en: 'Mods, shaders, resource packs and modpacks without leaving the launcher.',
      fr: 'Mods, shaders, packs de ressources et modpacks sans quitter le launcher.',
      de: 'Mods, Shader, Ressourcenpakete und Modpacks, ohne den Launcher zu verlassen.',
      es: 'Mods, shaders, paquetes de recursos y modpacks sin salir del launcher.',
      pl: 'Mody, shadery, paczki zasobów i modpacki bez wychodzenia z launchera.',
      ru: 'Моды, шейдеры, ресурспаки и сборки — не выходя из лаунчера.',
      zh: '无需离开启动器即可获取模组、光影、资源包和整合包。',
    },
    body: {
      en: 'Open an instance and choose Add to browse Modrinth. Dependencies are installed for you, updates are detected, and a restore point can be taken before every update so you can roll back if something breaks.',
      fr: 'Ouvrez une instance et choisissez Ajouter pour parcourir Modrinth. Les dépendances sont installées pour vous, les mises à jour sont détectées, et un point de restauration peut être créé avant chaque mise à jour pour revenir en arrière en cas de problème.',
      de: 'Öffne eine Instanz und wähle Hinzufügen, um Modrinth zu durchsuchen. Abhängigkeiten werden automatisch installiert, Updates werden erkannt, und vor jedem Update kann ein Wiederherstellungspunkt erstellt werden, damit du zurückkehren kannst, falls etwas kaputtgeht.',
      es: 'Abre una instancia y elige Añadir para explorar Modrinth. Las dependencias se instalan solas, las actualizaciones se detectan y se puede crear un punto de restauración antes de cada actualización para volver atrás si algo falla.',
      pl: 'Otwórz instancję i wybierz Dodaj, aby przeglądać Modrinth. Zależności instalują się same, aktualizacje są wykrywane, a przed każdą aktualizacją można utworzyć punkt przywracania, by cofnąć zmiany, jeśli coś się zepsuje.',
      ru: 'Откройте профиль и нажмите «Добавить», чтобы просматривать Modrinth. Зависимости устанавливаются автоматически, обновления обнаруживаются, а перед каждым обновлением можно создать точку восстановления, чтобы откатиться, если что-то сломается.',
      zh: '打开一个实例并选择“添加”即可浏览 Modrinth。依赖会自动安装，更新会被检测到，每次更新前都可以创建还原点，出问题时可以回滚。',
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
        title: { en: 'Join the Discord', fr: 'Rejoindre le Discord', de: 'Tritt dem Discord bei', es: 'Únete al Discord', pl: 'Dołącz do Discorda', ru: 'Присоединяйтесь к Discord', zh: '加入 Discord' },
        summary: {
          en: 'News and help: join the Swift Client community.',
          fr: 'Nouveautés et entraide : rejoignez la communauté Swift Client.',
          de: 'Neuigkeiten und Hilfe: Tritt der Swift-Client-Community bei.',
          es: 'Novedades y ayuda: únete a la comunidad de Swift Client.',
          pl: 'Nowości i pomoc: dołącz do społeczności Swift Client.',
          ru: 'Новости и помощь: присоединяйтесь к сообществу Swift Client.',
          zh: '新闻与帮助：加入 Swift Client 社区。',
        },
        body: { en: '', fr: '' },
      } satisfies NewsItem]
    : []),
]
