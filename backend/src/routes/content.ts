// Home news and changelog for the launcher, edited without a launcher release.
//
// DATA_DIR/news.json (optional, read on every request, see README):
//   { "news": [NewsItem…], "changelog": [ChangelogEntry…] }
// Images named without a scheme ("event.png") are served from DATA_DIR/news/.
// Without the file (or when it is invalid) the launcher shows the news it ships with.
import { existsSync, readFileSync } from 'node:fs'
import { basename, extname, resolve } from 'node:path'
import { Hono } from 'hono'
import { env } from '../env.js'

type Localized = { en: string } & Record<string, string>

const newsFile = resolve(env.dataDir, 'news.json')
const mediaDir = resolve(env.dataDir, 'news')

const MEDIA_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

function localized(value: unknown): Localized | null {
  if (!value || typeof value !== 'object') return null
  const entries = Object.entries(value).filter(([, text]) => typeof text === 'string')
  const out = Object.fromEntries(entries) as Record<string, string>
  return typeof out.en === 'string' ? out as Localized : null
}

function imageUrl(image: string): string {
  return /^https?:\/\//.test(image) ? image : `${env.publicUrl}/api/news/media/${encodeURIComponent(basename(image))}`
}

function readNews() {
  if (!existsSync(newsFile)) return null
  try {
    const raw = JSON.parse(readFileSync(newsFile, 'utf8')) as { news?: unknown[], changelog?: unknown[] }
    const news = (Array.isArray(raw.news) ? raw.news : []).flatMap((item) => {
      const n = item as Record<string, unknown>
      const title = localized(n.title)
      const summary = localized(n.summary)
      if (typeof n.id !== 'string' || typeof n.date !== 'string' || typeof n.image !== 'string' || !title || !summary) return []
      return [{
        id: n.id,
        date: n.date,
        image: imageUrl(n.image),
        title,
        summary,
        body: localized(n.body) ?? { en: '' },
        ...(typeof n.url === 'string' ? { url: n.url } : {}),
        ...(n.direct === true ? { direct: true } : {}),
      }]
    })
    const changelog = (Array.isArray(raw.changelog) ? raw.changelog : []).flatMap((entry) => {
      const e = entry as Record<string, unknown>
      const items = (Array.isArray(e.items) ? e.items : []).map(localized).filter((i): i is Localized => !!i)
      if (typeof e.version !== 'string' || typeof e.date !== 'string' || !items.length) return []
      return [{ version: e.version, date: e.date, items }]
    })
    return { news, changelog }
  } catch (e) {
    console.error('[news] unreadable', e)
    return null
  }
}

export const contentRoutes = new Hono()

contentRoutes.get('/', (c) => {
  const content = readNews()
  return content ? c.json(content) : c.json({ message: 'no news published' }, 404)
})

contentRoutes.get('/media/:file', (c) => {
  const file = basename(c.req.param('file'))
  const type = MEDIA_TYPES[extname(file).toLowerCase()]
  const path = resolve(mediaDir, file)
  if (!type || !existsSync(path)) return c.json({ message: 'not found' }, 404)
  return new Response(readFileSync(path), {
    headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=3600' },
  })
})
