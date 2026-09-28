import { invoke } from '@tauri-apps/api/core'
import { NEWS, type NewsItem } from '~/content/news'
import { CHANGELOG, type ChangelogEntry } from '~/content/changelog'

let requested = false

const isLocalized = (v: unknown): boolean => !!v && typeof v === 'object' && typeof (v as { en?: unknown }).en === 'string'

/**
 * Home news and changelog. Starts with what ships in content/ and switches to
 * what the backend publishes (DATA_DIR/news.json) once it answers, so news can
 * change without a launcher release. Fetched once per session.
 */
export const useHomeContent = () => {
  const news = useState<NewsItem[]>('sw-home-news', () => NEWS)
  const changelog = useState<ChangelogEntry[]>('sw-home-changelog', () => CHANGELOG)

  if (!requested && import.meta.client) {
    requested = true
    invoke<{ news?: unknown, changelog?: unknown } | null>('swift_home_content')
      .then((remote) => {
        if (!remote) return
        const items = Array.isArray(remote.news)
          ? remote.news.filter((n): n is NewsItem => isLocalized(n?.title) && isLocalized(n?.summary) && typeof n?.id === 'string')
          : []
        const releases = Array.isArray(remote.changelog)
          ? remote.changelog.filter((e): e is ChangelogEntry => typeof e?.version === 'string' && Array.isArray(e?.items) && e.items.every(isLocalized))
          : []
        if (items.length) news.value = items
        if (releases.length) changelog.value = releases
      })
      .catch(() => {})
  }

  return { news, changelog }
}
