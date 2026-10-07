// Serves the admin panel (static files in backend/admin) at /admin, and at / on the admin host.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Hono } from 'hono'
import { env } from '../env.js'

const ROOT = resolve(fileURLToPath(new URL('../../admin/', import.meta.url)))
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2',
}

function serve(sub: string): Response {
  let rel = decodeURIComponent(sub).replace(/^\/+/, '')
  if (!rel || !extname(rel)) rel = 'index.html'
  const path = resolve(ROOT, rel)
  const type = TYPES[extname(path).toLowerCase()]
  if (!path.startsWith(ROOT + sep) || !type || !existsSync(path) || !statSync(path).isFile()) return new Response('Not found', { status: 404 })
  return new Response(new Uint8Array(readFileSync(path)), { headers: { 'Content-Type': type, 'Cache-Control': 'no-cache' } })
}

export function registerAdminStatic(app: Hono<any>) {
  if (!env.adminPanelEnabled) return
  const adminHost = new URL(env.adminPublicUrl).host
  // On the admin host, everything that is not API/CDN is the panel.
  app.use('*', async (c, next) => {
    const path = new URL(c.req.url).pathname
    const host = (c.req.header('host') ?? '').toLowerCase()
    if (host === adminHost && !path.startsWith('/api/') && !path.startsWith('/cdn/') && path !== '/health' && path !== '/ready' && path !== '/version') {
      return serve(path.startsWith('/admin') ? path.slice('/admin'.length) : path)
    }
    await next()
  })
  app.get('/admin', c => c.redirect('/admin/'))
  app.get('/admin/*', (c) => serve(new URL(c.req.url).pathname.slice('/admin'.length)))
}
