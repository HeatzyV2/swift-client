import type { ContentKind, ModrinthProjectType } from '~/types/modrinth'

/** Kinds that can be browsed/installed into an existing instance. */
export const INSTALLABLE_KINDS: ContentKind[] = ['mod', 'resourcepack', 'shader', 'datapack']

export function searchProjectType(kind: ContentKind): ModrinthProjectType {
  // Datapacks are a first-class Modrinth project type (not "mod" + category).
  if (kind === 'datapack') return 'datapack'
  return kind as ModrinthProjectType
}

export function baseCategories(_kind: ContentKind): string[] {
  return []
}

export function usesLoaderFilter(kind: ContentKind): boolean {
  return kind === 'mod' || kind === 'modpack'
}

export function loaderFacetFor(kind: ContentKind, loader?: string): string[] {
  // Datapack versions are tagged with the "datapack" loader on Modrinth.
  if (kind === 'datapack') return ['datapack']
  if (usesLoaderFilter(kind) && loader && loader !== 'vanilla') return [loader]
  return []
}

export function compactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}
