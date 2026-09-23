import { Hono } from 'hono'
import { env } from '../env.js'

const CF = 'https://api.curseforge.com/v1'

export const curseforgeRoutes = new Hono()

curseforgeRoutes.all('/*', async (c) => {
  if (!env.curseforgeApiKey) {
    return c.json({ message: 'CurseForge is not configured on the Swift Client server' }, 501)
  }

  let path = c.req.path
  if (path.startsWith('/api/curseforge')) {
    path = path.slice('/api/curseforge'.length) || '/'
  }
  if (!path.startsWith('/')) path = `/${path}`

  const url = new URL(c.req.url)
  const target = `${CF}${path}${url.search}`

  const headers = new Headers()
  headers.set('Accept', 'application/json')
  headers.set('x-api-key', env.curseforgeApiKey)
  headers.set('User-Agent', `SwiftClient-Backend/${env.version}`)

  const method = c.req.method
  let body: ArrayBuffer | undefined
  if (method !== 'GET' && method !== 'HEAD') {
    body = await c.req.arrayBuffer()
    const ct = c.req.header('content-type')
    if (ct) headers.set('Content-Type', ct)
  }

  const upstream = await fetch(target, { method, headers, body })
  const out = new Headers()
  const ct = upstream.headers.get('content-type')
  if (ct) out.set('content-type', ct)
  const retry = upstream.headers.get('retry-after')
  if (retry) out.set('retry-after', retry)

  return new Response(upstream.body, { status: upstream.status, headers: out })
})
