import type { Localized } from './news'

/**
 * Condensed release notes for the Home side panel — a few lines per release,
 * newest first. Only the first entry is shown.
 */
export interface ChangelogEntry {
  version: string
  date: string
  items: Localized[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.1',
    date: '2026-09-23',
    items: [
      { en: 'Home centred on your selected instance', fr: 'Accueil centré sur l’instance sélectionnée', de: 'Startseite rund um deine ausgewählte Instanz', es: 'Inicio centrado en tu instancia seleccionada', pl: 'Strona główna skupiona na wybranej instancji', ru: 'Главная страница вокруг выбранного профиля', zh: '以所选实例为中心的主页' },
      { en: 'Vanilla, Fabric, Quilt, Forge and NeoForge', fr: 'Vanilla, Fabric, Quilt, Forge et NeoForge', de: 'Vanilla, Fabric, Quilt, Forge und NeoForge', es: 'Vanilla, Fabric, Quilt, Forge y NeoForge', pl: 'Vanilla, Fabric, Quilt, Forge i NeoForge', ru: 'Vanilla, Fabric, Quilt, Forge и NeoForge', zh: 'Vanilla、Fabric、Quilt、Forge 和 NeoForge' },
      { en: 'Modrinth built in, with restore points', fr: 'Modrinth intégré, avec points de restauration', de: 'Modrinth integriert, mit Wiederherstellungspunkten', es: 'Modrinth integrado, con puntos de restauración', pl: 'Wbudowany Modrinth z punktami przywracania', ru: 'Встроенный Modrinth с точками восстановления', zh: '内置 Modrinth，支持还原点' },
    ],
  },
]
