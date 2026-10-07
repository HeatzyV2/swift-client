import assert from 'node:assert/strict'
import { test } from 'node:test'
import { call, staff, db, cache } from './helpers.js'
import { promoteScheduled } from '../src/platform/modules/cms/news.js'

test('news: draft is invisible, publishing exposes it to launcher and legacy /api/news', async () => {
  const cm = await staff(['CONTENT_MANAGER'])
  const owner = await staff(['OWNER'])
  assert.equal((await call('GET', '/api/news')).status, 404)
  const created = await call('POST', '/api/v1/news', { token: cm.token, body: { title: { en: 'Big update', fr: 'Grosse mise à jour' }, summary: { en: 'Sum', fr: 'Résumé' }, image: 'https://cdn.test/a.png' } })
  assert.equal(created.status, 201)
  const id = created.body.data.id as string
  assert.equal(created.body.data.status, 'draft')
  assert.equal((await call('GET', '/api/v1/launcher/news')).body.data.length, 0)
  // content managers hold news.publish
  const pub = await call('POST', `/api/v1/news/${id}/status`, { token: cm.token, body: { status: 'published' } })
  assert.equal(pub.status, 200)
  const fr = await call('GET', '/api/v1/launcher/news?locale=fr')
  assert.equal(fr.body.data[0].title, 'Grosse mise à jour')
  const en = await call('GET', '/api/v1/launcher/news?locale=de')
  assert.equal(en.body.data[0].title, 'Big update')
  const legacy = await call('GET', '/api/news')
  assert.equal(legacy.status, 200)
  assert.equal(legacy.body.news[0].title.fr, 'Grosse mise à jour')
  assert.equal(legacy.body.news[0].image, 'https://cdn.test/a.png')
  assert.ok(Array.isArray(legacy.body.changelog))
  // published news cannot be deleted without archiving first
  assert.equal((await call('DELETE', `/api/v1/news/${id}`, { token: owner.token })).status, 409)
  await call('POST', `/api/v1/news/${id}/status`, { token: owner.token, body: { status: 'archived' } })
  assert.equal((await call('DELETE', `/api/v1/news/${id}`, { token: owner.token })).status, 200)
})

test('news: scheduled content goes live at publishAt', async () => {
  const owner = await staff(['OWNER'])
  const future = new Date(Date.now() + 3_600_000).toISOString()
  const r = await call('POST', '/api/v1/news', { token: owner.token, body: { title: { en: 'Soon' }, summary: { en: 's' }, status: 'scheduled', publishAt: future } })
  assert.equal(r.status, 201)
  cache.clear()
  assert.ok(!(await call('GET', '/api/v1/launcher/news')).body.data.some((n: { title: string }) => n.title === 'Soon'))
  db.prepare('UPDATE news SET publish_at = ? WHERE id = ?').run(new Date(Date.now() - 1000).toISOString(), r.body.data.id)
  cache.clear()
  assert.ok((await call('GET', '/api/v1/launcher/news')).body.data.some((n: { title: string }) => n.title === 'Soon'))
  assert.ok(promoteScheduled() >= 1)
  const detail = await call('GET', `/api/v1/news/${r.body.data.id}`, { token: owner.token })
  assert.equal(detail.body.data.status, 'published')
})

test('news: rejects javascript: links and non-asset images', async () => {
  const owner = await staff(['OWNER'])
  const body = { title: { en: 'x' }, summary: { en: 'x' } }
  assert.equal((await call('POST', '/api/v1/news', { token: owner.token, body: { ...body, url: 'javascript:alert(1)' } })).status, 422)
  assert.equal((await call('POST', '/api/v1/news', { token: owner.token, body: { ...body, image: 'file:///etc/passwd' } })).status, 422)
})

test('home builder: draft -> publish -> change -> rollback', async () => {
  const cm = await staff(['CONTENT_MANAGER'])
  const home0 = await call('GET', '/api/v1/launcher/bootstrap')
  assert.equal(home0.body.data.home, null)
  const a = await call('POST', '/api/v1/home/sections', { token: cm.token, body: { kind: 'hero', title: { en: 'Welcome', fr: 'Bienvenue' }, config: { subtitle: { en: 'Fast' }, cta: { label: { en: 'Play' }, url: 'https://swiftclient.fr' } } } })
  assert.equal(a.status, 201)
  const b = await call('POST', '/api/v1/home/sections', { token: cm.token, body: { kind: 'text', config: { body: { en: 'Hello' } } } })
  const list = await call('GET', '/api/v1/home/sections', { token: cm.token })
  assert.equal(list.body.data.dirty, true)
  // draft is not live yet
  assert.equal((await call('GET', '/api/v1/launcher/bootstrap')).body.data.home, null)
  const preview = await call('GET', '/api/v1/home/preview?locale=fr', { token: cm.token })
  assert.equal(preview.body.data.sections[0].title, 'Bienvenue')
  const p1 = await call('POST', '/api/v1/home/publish', { token: cm.token, body: { note: 'v1' } })
  assert.equal(p1.status, 201)
  const live = (await call('GET', '/api/v1/launcher/bootstrap?locale=fr')).body.data.home
  assert.equal(live.sections.length, 2)
  assert.equal(live.sections[0].cta.label, 'Play')
  // reorder + disable second, publish again
  const ids = [b.body.data.id, a.body.data.id]
  assert.equal((await call('PUT', '/api/v1/home/sections/order', { token: cm.token, body: { ids } })).status, 200)
  assert.equal((await call('PUT', '/api/v1/home/sections/order', { token: cm.token, body: { ids: [ids[0]] } })).status, 400)
  await call('PUT', `/api/v1/home/sections/${a.body.data.id}`, { token: cm.token, body: { kind: 'hero', title: { en: 'Welcome' }, enabled: false, config: {} } })
  const p2 = await call('POST', '/api/v1/home/publish', { token: cm.token, body: {} })
  assert.equal((await call('GET', '/api/v1/launcher/bootstrap')).body.data.home.sections.length, 1)
  // rollback to v1
  const rb = await call('POST', `/api/v1/home/snapshots/${p1.body.data.snapshotId}/rollback`, { token: cm.token, body: {} })
  assert.equal(rb.status, 200)
  assert.equal((await call('GET', '/api/v1/launcher/bootstrap')).body.data.home.sections.length, 2)
  const hist = await call('GET', '/api/v1/home/snapshots', { token: cm.token })
  assert.equal(hist.body.data.filter((s: { active: boolean }) => s.active).length, 1)
  assert.ok(p2.body.data.snapshotId > p1.body.data.snapshotId)
})

test('home sections are validated (no unknown config keys, bad urls refused)', async () => {
  const cm = await staff(['CONTENT_MANAGER'])
  const bad = await call('POST', '/api/v1/home/sections', { token: cm.token, body: { kind: 'hero', config: { script: '<script>' } } })
  assert.equal(bad.status, 422)
  const badUrl = await call('POST', '/api/v1/home/sections', { token: cm.token, body: { kind: 'banner', config: { image: 'https://x.test/a.png', url: 'javascript:1' } } })
  assert.equal(badUrl.status, 422)
})

test('announcements: scheduling window and targeting', async () => {
  const cm = await staff(['CONTENT_MANAGER'])
  const now = Date.now()
  const mk = (extra: object) => call('POST', '/api/v1/announcements', { token: cm.token, body: { type: 'warning', title: { en: 'Heads up' }, ...extra } })
  await mk({ startsAt: new Date(now + 3_600_000).toISOString() })
  await mk({ endsAt: new Date(now - 3_600_000).toISOString() })
  const live = await mk({ type: 'critical', title: { en: 'Live now' } })
  const win = await mk({ title: { en: 'Windows only' }, targeting: { os: ['windows'] } })
  assert.equal(live.status, 201)
  cache.clear()
  const mac = (await call('GET', '/api/v1/launcher/bootstrap?os=macos&arch=arm64&v=1.0.0')).body.data.announcements.map((a: { title: string }) => a.title)
  assert.deepEqual(mac, ['Live now'])
  const winRes = (await call('GET', '/api/v1/launcher/bootstrap?os=windows&arch=x64&v=1.0.0')).body.data.announcements.map((a: { title: string }) => a.title)
  assert.deepEqual(winRes, ['Live now', 'Windows only'])
  assert.equal(win.status, 201)
})
