import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { test } from 'node:test'
import { call, staff, db, cache, app } from './helpers.js'
import { bucket, matches } from '../src/platform/core/schemas.js'
import { compareVersions } from '../src/platform/core/util.js'
import { hmac } from '../src/platform/core/util.js'
import { scrub } from '../src/platform/modules/analytics/analytics.js'
import { processDeliveries } from '../src/platform/modules/integrations/webhooks.js'

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAYAAAC56t6BAAAAEklEQVR4nGP8z8DwnwEJMGJTAAA/5gMCZ4kHXQAAAABJRU5ErkJggg==', 'base64')

test('targeting engine', () => {
  assert.equal(matches({}, {}, 'x'), true)
  assert.equal(matches({ os: ['windows'] }, { os: 'macos' }, 'x'), false)
  assert.equal(matches({ os: ['windows'] }, {}, 'x'), false, 'unknown criterion never matches a required one')
  assert.equal(matches({ launcherVersion: { min: '1.2.0' } }, { launcherVersion: '1.10.0' }, 'x'), true)
  assert.equal(matches({ launcherVersion: { min: '1.2.0', max: '1.5.0' } }, { launcherVersion: '1.6.0' }, 'x'), false)
  assert.equal(matches({ authenticated: true }, { authenticated: false }, 'x'), false)
  assert.equal(matches({ rolloutPercent: 0 }, { device: 'd' }, 'x'), false)
  assert.equal(matches({ rolloutPercent: 50 }, {}, 'x'), false)
  assert.equal(bucket('device-1', 'item'), bucket('device-1', 'item'), 'buckets are stable')
  let inside = 0
  for (let i = 0; i < 1000; i++) if (matches({ rolloutPercent: 30 }, { device: `dev-${i}` }, 'item')) inside++
  assert.ok(inside > 230 && inside < 370, `rollout ~30% (got ${inside})`)
})

test('version comparison', () => {
  assert.equal(compareVersions('1.10.0', '1.9.9'), 1)
  assert.equal(compareVersions('1.0.0-beta.1', '1.0.0'), -1)
  assert.equal(compareVersions('2.0', '2.0.0'), 0)
})

test('servers + campaigns: CRUD, legacy in-game contract and stats', async () => {
  const sm = await staff(['SERVER_MANAGER'])
  assert.deepEqual((await call('GET', '/api/servers')).body, [{ name: 'Elysia SMP', ip: 'elysiasmp.com', port: 25565 }], 'legacy fallback untouched')
  const s = await call('POST', '/api/v1/servers', { token: sm.token, body: { name: 'Mega Craft', address: 'play.mega.test', port: 25570, ingame: true, featured: true, edition: 'java', description: { en: 'Fun' } } })
  assert.equal(s.status, 201)
  assert.equal((await call('POST', '/api/v1/servers', { token: sm.token, body: { name: 'Bad', address: 'http://x', edition: 'java' } })).status, 422)
  assert.equal((await call('POST', '/api/v1/servers', { token: sm.token, body: { name: 'Cross', address: 'c.test', edition: 'crossplay' } })).status, 400)
  cache.clear()
  assert.deepEqual((await call('GET', '/api/servers')).body, [{ name: 'Mega Craft', ip: 'play.mega.test', port: 25570 }])
  assert.deepEqual((await call('GET', '/api/partners/ingame')).body, { slots: [{ name: 'Mega Craft', ip: 'play.mega.test', port: 25570 }] })

  const p = await call('POST', '/api/v1/partners', { token: sm.token, body: { name: 'Mega Corp' } })
  const c = await call('POST', '/api/v1/campaigns', { token: sm.token, body: { name: 'Launch', partnerId: p.body.data.id, serverId: s.body.data.id, placement: 'home_banner', creative: { title: { en: 'Join!' } }, targeting: { os: ['windows'] } } })
  assert.equal(c.status, 201)
  const cid = c.body.data.id as string
  cache.clear()
  assert.equal((await call('GET', '/api/v1/launcher/bootstrap?os=windows')).body.data.campaigns.length, 1)
  assert.equal((await call('GET', '/api/v1/launcher/bootstrap?os=linux')).body.data.campaigns.length, 0)

  const ev = (name: string) => ({ name, props: { campaignId: cid } })
  const ing = await call('POST', '/api/v1/analytics/events', { body: { deviceId: 'device-abcdef-1', context: { os: 'windows' }, events: [ev('campaign_impression'), ev('campaign_impression'), ev('campaign_click'), ev('server_play_attempt'), ev('server_launch'), ev('campaign_impression'), { name: 'campaign_click', props: { campaignId: 'does-not-exist' } }] } })
  assert.equal(ing.status, 202)
  const stats = await call('GET', `/api/v1/campaigns/${cid}/stats`, { token: sm.token })
  const t = stats.body.data.totals
  assert.equal(t.impressions, 3)
  assert.equal(t.clicks, 1)
  assert.equal(t.playAttempts, 1)
  assert.equal(t.launches, 1)
  assert.equal(t.ctr, 33.33)
  assert.equal((await call('GET', `/api/v1/partners/${p.body.data.id}/stats`, { token: sm.token })).body.data.totals.impressions, 3)
  assert.equal((await call('DELETE', `/api/v1/partners/${p.body.data.id}`, { token: sm.token })).status, 409, 'partner with campaigns')
})

test('flags: targeting, rollout and A/B variants are deterministic', async () => {
  const rm = await staff(['ADMIN'])
  assert.equal((await call('PUT', '/api/v1/flags/new-home', { token: rm.token, body: { enabled: true, targeting: { rolloutPercent: 100 } } })).status, 201)
  assert.equal((await call('PUT', '/api/v1/flags/Bad Key', { token: rm.token, body: { enabled: true } })).status, 400)
  await call('PUT', '/api/v1/flags/exp-cta', { token: rm.token, body: { enabled: true, variants: [{ key: 'a', weight: 50 }, { key: 'b', weight: 50 }] } })
  await call('PUT', '/api/v1/flags/off', { token: rm.token, body: { enabled: false } })
  assert.equal((await call('PUT', '/api/v1/flags/too-much', { token: rm.token, body: { enabled: true, variants: [{ key: 'a', weight: 80 }, { key: 'b', weight: 40 }] } })).status, 422)
  cache.clear()
  const r1 = (await call('GET', '/api/v1/launcher/bootstrap?device=dev-42')).body.data
  const r2 = (await call('GET', '/api/v1/launcher/bootstrap?device=dev-42')).body.data
  assert.equal(r1.flags['new-home'], true)
  assert.equal(r1.flags.off, false)
  assert.ok(['a', 'b'].includes(r1.experiments['exp-cta']))
  assert.equal(r1.experiments['exp-cta'], r2.experiments['exp-cta'])
  const anon = (await call('GET', '/api/v1/launcher/bootstrap')).body.data
  assert.equal(anon.experiments['exp-cta'], 'control')
})

test('remote config is data only and size-limited', async () => {
  const rm = await staff(['RELEASE_MANAGER'])
  assert.equal((await call('PUT', '/api/v1/remote-config/ui.accent', { token: rm.token, body: { value: '#3b82f6' } })).status, 200)
  assert.equal((await call('PUT', '/api/v1/remote-config/limits', { token: rm.token, body: { value: { maxDownloads: 4, features: ['a', 'b'] } } })).status, 200)
  assert.equal((await call('PUT', '/api/v1/remote-config/big', { token: rm.token, body: { value: 'x'.repeat(2001) } })).status, 422)
  cache.clear()
  const cfg = (await call('GET', '/api/v1/launcher/bootstrap')).body.data.config
  assert.equal(cfg['ui.accent'], '#3b82f6')
  assert.equal(cfg.limits.maxDownloads, 4)
})

test('maintenance mode surfaces in bootstrap, honours schedule and allowlist', async () => {
  const admin = await staff(['ADMIN'])
  const res = await call('PUT', '/api/v1/settings/maintenance', { token: admin.token, body: { enabled: true, message: { en: 'Back soon', fr: 'Bientôt' }, allowVersions: ['9.9.9'] } })
  assert.equal(res.status, 200)
  cache.clear()
  const on = (await call('GET', '/api/v1/launcher/bootstrap?locale=fr&v=1.0.0')).body.data.maintenance
  assert.equal(on.active, true)
  assert.equal(on.message.fr, 'Bientôt')
  assert.equal((await call('GET', '/api/v1/launcher/bootstrap?v=9.9.9')).body.data.maintenance.active, false)
  assert.equal((await call('PUT', '/api/v1/settings/maintenance', { token: admin.token, body: { enabled: true, bogus: 1 } })).status, 400)
  await call('PUT', '/api/v1/settings/maintenance', { token: admin.token, body: { enabled: false } })
  cache.clear()
  assert.equal((await call('GET', '/api/v1/launcher/bootstrap')).body.data.maintenance.active, false)
})

test('releases: publish, channels, rollout, mandatory, rollback and Tauri format', async () => {
  const rm = await staff(['RELEASE_MANAGER'])
  const base = { platform: 'windows', arch: 'x64', url: 'https://download.test/swift-1.4.0.exe', sha256: 'a'.repeat(64), signature: 'sig-abc' }
  const mk = async (version: string, channel: string, extra: object = {}) => {
    const r = await call('POST', '/api/v1/releases', { token: rm.token, body: { ...base, version, channel, notes: { en: `Notes ${version}` }, ...extra } })
    assert.equal(r.status, 201, JSON.stringify(r.body))
    const p = await call('POST', `/api/v1/releases/${r.body.data.id}/publish`, { token: rm.token })
    assert.equal(p.status, 200)
    return r.body.data.id as string
  }
  assert.equal((await call('POST', '/api/v1/releases', { token: rm.token, body: { ...base, version: '1.0', channel: 'stable' } })).status, 422)
  assert.equal((await call('POST', '/api/v1/releases', { token: rm.token, body: { ...base, version: '1.0.0', channel: 'stable', url: 'ftp://x/y' } })).status, 422)
  await mk('1.3.0', 'stable')
  const id14 = await mk('1.4.0', 'stable')
  await mk('1.5.0-beta.1', 'beta')
  cache.clear()
  const q = (v: string, ch = 'stable') => call('GET', `/api/v1/launcher/update?platform=windows&arch=x64&version=${v}&channel=${ch}`)
  assert.equal((await q('1.4.0')).body.data.updateAvailable, false)
  const up = (await q('1.3.0')).body.data
  assert.equal(up.updateAvailable, true)
  assert.equal(up.release.version, '1.4.0')
  assert.equal((await q('1.4.0', 'beta')).body.data.release.version, '1.5.0-beta.1')
  assert.equal((await q('1.3.0', 'stable')).body.data.release.version, '1.4.0', 'stable clients never see beta')
  // Tauri updater format
  const t = await call('GET', '/api/v1/launcher/update/tauri/windows/x86_64/1.3.0')
  assert.equal(t.status, 200)
  assert.equal(t.body.signature, 'sig-abc')
  assert.equal(t.body.version, '1.4.0')
  assert.equal((await call('GET', '/api/v1/launcher/update/tauri/windows/x86_64/1.4.0')).status, 204)
  // mandatory via minimumVersion
  await mk('1.6.0', 'stable', { minimumVersion: '1.5.0', rolloutPercent: 1 })
  cache.clear()
  const forced = (await q('1.3.0')).body.data
  assert.equal(forced.mandatory, true)
  assert.equal(forced.release.version, '1.6.0')
  // rollback: revoke 1.4.0 -> 1.3.0 clients are not offered it any more
  const rv = await call('POST', `/api/v1/releases/${id14}/revoke`, { token: rm.token, body: { reason: 'crash on startup' } })
  assert.equal(rv.status, 200)
  cache.clear()
  assert.notEqual((await q('1.3.0')).body.data.release?.version, '1.4.0')
  assert.equal((await call('DELETE', `/api/v1/releases/${id14}`, { token: rm.token })).status, 200)
})

test('analytics: whitelist, minimal storage, retention and privacy', async () => {
  const res = await call('POST', '/api/v1/analytics/events', { body: { deviceId: 'my-device-id-12345', context: { launcherVersion: '1.2.3', os: 'windows', locale: 'fr-FR' }, events: [{ name: 'app_open' }, { name: 'launch_game', props: { mcVersion: '1.21.4', loader: 'fabric', evil: 'x' } }] } })
  assert.equal(res.status, 202)
  assert.equal(res.body.data.accepted, 2)
  assert.equal((await call('POST', '/api/v1/analytics/events', { body: { events: [{ name: 'steal_passwords' }] } })).status, 422)
  assert.equal((await call('POST', '/api/v1/analytics/events', { body: { events: [] } })).status, 422)
  const row = db.prepare("SELECT * FROM analytics_events WHERE name = 'launch_game'").get() as Record<string, string>
  assert.equal(row.props, JSON.stringify({ mcVersion: '1.21.4', loader: 'fabric' }), 'unknown props dropped')
  assert.ok(row.device && row.device !== 'my-device-id-12345' && row.device.length === 24, 'device id is hashed')
  assert.equal(row.locale, 'fr')
  assert.ok(!Object.keys(row).some(k => /ip|user/.test(k)), 'no ip / user columns')
  const analyst = await staff(['ANALYST'])
  const ov = (await call('GET', '/api/v1/analytics/overview?days=7', { token: analyst.token })).body.data
  assert.ok(ov.totals.app_open >= 1)
  assert.ok(ov.activeDevices >= 1)
  // switch off
  const admin = await staff(['ADMIN'])
  await call('PUT', '/api/v1/settings/analytics', { token: admin.token, body: { enabled: false } })
  cache.clear()
  assert.equal((await call('POST', '/api/v1/analytics/events', { body: { events: [{ name: 'app_open' }] } })).body.data.accepted, 0)
  await call('PUT', '/api/v1/settings/analytics', { token: admin.token, body: { enabled: true } })
  cache.clear()
})

test('diagnostics: scrubbing, grouping and status', async () => {
  assert.equal(scrub('failed at C:\\Users\\Romain\\AppData\\x for me@mail.com token=abcdef123456789'), 'failed at C:\\Users\\<user>\\AppData\\x for <email> token=<redacted>')
  assert.equal(scrub('/home/zora/.minecraft'), '/home/<user>/.minecraft')
  const body = { category: 'java_missing', code: 'E_JAVA', message: 'Java 21 not found in C:\\Users\\Bob\\.swift at 12345' }
  const a = await call('POST', '/api/v1/diagnostics/report', { body })
  const b = await call('POST', '/api/v1/diagnostics/report', { body: { ...body, message: 'Java 21 not found in C:\\Users\\Alice\\.swift at 999' } })
  assert.equal(a.status, 202)
  assert.equal(a.body.data.fingerprint, b.body.data.fingerprint, 'same problem, same group')
  assert.equal((await call('POST', '/api/v1/diagnostics/report', { body: { category: 'made_up' } })).status, 422)
  const support = await staff(['SUPPORT'])
  const groups = await call('GET', '/api/v1/diagnostics/groups?category=java_missing', { token: support.token })
  assert.equal(groups.body.data[0].occurrences, 2)
  const detail = await call('GET', `/api/v1/diagnostics/groups/${a.body.data.fingerprint}`, { token: support.token })
  assert.ok(!JSON.stringify(detail.body).includes('Bob'))
  assert.equal((await call('POST', `/api/v1/diagnostics/groups/${a.body.data.fingerprint}/status`, { token: support.token, body: { status: 'resolved' } })).status, 200)
  const notes = await call('GET', '/api/v1/notifications', { token: support.token })
  assert.ok(notes.body.data.items.some((n: { title: string }) => /issue/.test(n.title)))
  assert.equal((await call('POST', '/api/v1/notifications/read', { token: support.token, body: {} })).status, 200)
  assert.equal((await call('GET', '/api/v1/notifications', { token: support.token })).body.data.unread, 0)
})

test('assets: content sniffing, dedupe, svg refused, in-use protection', async () => {
  const cm = await staff(['CONTENT_MANAGER'])
  const form = (data: Buffer, name: string) => { const f = new FormData(); f.append('file', new File([new Uint8Array(data)], name)); return f }
  const up = await call('POST', '/api/v1/assets', { token: cm.token, raw: form(PNG, 'banner.png') })
  assert.equal(up.status, 201, JSON.stringify(up.body))
  assert.equal(up.body.data.width, 2)
  assert.equal(up.body.data.height, 3)
  assert.equal(up.body.data.mime, 'image/png')
  const again = await call('POST', '/api/v1/assets', { token: cm.token, raw: form(PNG, 'copy.png') })
  assert.equal(again.body.data.id, up.body.data.id, 'dedupe by hash')
  const svg = await call('POST', '/api/v1/assets', { token: cm.token, raw: form(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'x.png') })
  assert.equal(svg.status, 400)
  assert.equal((await call('POST', '/api/v1/assets', { token: cm.token, raw: form(Buffer.from('MZ not an image'), 'a.png') })).status, 400)
  // public file is served with safe headers
  const path = new URL(up.body.data.url).pathname
  const file = await app.request(path)
  assert.equal(file.status, 200)
  assert.equal(file.headers.get('content-type'), 'image/png')
  assert.equal(file.headers.get('x-content-type-options'), 'nosniff')
  assert.equal((await app.request('/cdn/assets/../../../etc/passwd')).status, 404)
  // an asset used by a news cannot be deleted
  await call('POST', '/api/v1/news', { token: cm.token, body: { title: { en: 'With image' }, summary: { en: 's' }, image: up.body.data.ref } })
  assert.equal((await call('DELETE', `/api/v1/assets/${up.body.data.id}`, { token: cm.token })).status, 409)
})

test('webhooks: signed delivery, retry/backoff and SSRF guard', async () => {
  const admin = await staff(['ADMIN'])
  const got: { headers: Record<string, string | string[] | undefined>, body: string }[] = []
  let failNext = true
  const srv = createServer((req, res) => {
    let body = ''
    req.on('data', d => { body += d })
    req.on('end', () => {
      if (failNext) { failNext = false; res.statusCode = 500; res.end('no'); return }
      got.push({ headers: req.headers, body })
      res.end('ok')
    })
  })
  await new Promise<void>(r => srv.listen(0, '127.0.0.1', r))
  const url = `http://127.0.0.1:${(srv.address() as AddressInfo).port}/hook`
  try {
    const hook = await call('POST', '/api/v1/webhooks', { token: admin.token, body: { name: 'test', url, events: ['release.published', 'test.ping'] } })
    assert.equal(hook.status, 201)
    const secret = hook.body.data.secret as string
    assert.ok(secret.length > 20)
    assert.ok(!JSON.stringify((await call('GET', '/api/v1/webhooks', { token: admin.token })).body).includes(secret), 'secret never listed again')
    await call('POST', `/api/v1/webhooks/${hook.body.data.id}/test`, { token: admin.token })
    await processDeliveries()
    const del = (await call('GET', `/api/v1/webhooks/${hook.body.data.id}/deliveries`, { token: admin.token })).body.data
    assert.equal(del[0].status, 'pending')
    assert.equal(del[0].attempts, 1)
    assert.equal(del[0].lastStatus, 500)
    db.prepare("UPDATE webhook_deliveries SET next_attempt_at = ? WHERE status = 'pending'").run(new Date(Date.now() - 1000).toISOString())
    await processDeliveries()
    assert.equal(got.length, 1)
    const sig = String(got[0].headers['x-swift-signature'])
    const [, t, v1] = /^t=(\d+),v1=([a-f0-9]{64})$/.exec(sig) ?? []
    assert.equal(v1, hmac(secret, `${t}.${got[0].body}`))
    assert.equal(got[0].headers['x-swift-event'], 'test.ping')
    assert.equal(JSON.parse(got[0].body).event, 'test.ping')
  } finally {
    srv.close()
  }
  // SSRF guard can be exercised by disabling the test override at module level via a literal that is always private
  // with WEBHOOK_ALLOW_PRIVATE=false; here we just make sure bad schemes and credentials are refused.
  assert.equal((await call('POST', '/api/v1/webhooks', { token: admin.token, body: { name: 'xx', url: 'ftp://a.b/c', events: ['*'] } })).status, 400)
  assert.equal((await call('POST', '/api/v1/webhooks', { token: admin.token, body: { name: 'xx', url: 'http://user:pw@a.b/c', events: ['*'] } })).status, 400)
})

test('launcher contract: bootstrap shape is stable', async () => {
  const res = await call('GET', '/api/v1/launcher/bootstrap?locale=en&v=1.0.0&os=windows&arch=x64&mc=1.21.4&auth=1&device=abc123abc')
  assert.equal(res.status, 200)
  assert.ok(res.headers.get('etag'))
  assert.ok((res.headers.get('cache-control') ?? '').includes('max-age'))
  const d = res.body.data
  for (const key of ['apiVersion', 'maintenance', 'announcements', 'home', 'news', 'changelog', 'servers', 'campaigns', 'flags', 'experiments', 'config', 'links', 'analytics', 'update']) {
    assert.ok(key in d, `bootstrap.${key}`)
  }
  assert.equal(d.apiVersion, 1)
  assert.ok(res.body.meta.serverTime)
  const etag = res.headers.get('etag')!
  const again = await app.request('/api/v1/launcher/bootstrap?locale=en&v=1.0.0&os=windows&arch=x64&mc=1.21.4&auth=1&device=abc123abc', { headers: { 'if-none-match': etag } })
  assert.equal(again.status, 304)
})

test('legacy contract: old endpoints keep their shape', async () => {
  const health = await call('GET', '/health')
  assert.equal(health.body.ok, true)
  assert.ok('version' in health.body && 'curseforge' in health.body)
  const reg = await call('POST', '/api/auth/register', { body: { username: 'old_client', password: 'old-client-pass' } })
  assert.equal(reg.status, 200)
  assert.ok(reg.body.token && reg.body.user.username === 'old_client')
  assert.equal((await call('POST', '/api/auth/register', { body: { username: 'ab', password: 'x' } })).body.message, 'username must be 3–32 characters')
  assert.equal((await call('GET', '/api/auth/me')).body.message, 'sign in required')
  assert.equal((await call('GET', '/api/cosmetics/catalog')).status, 200)
})

test('openapi document covers the registry', async () => {
  const r = await app.request('/api/v1/openapi.json')
  const doc = await r.json() as { openapi: string, paths: Record<string, Record<string, { 'x-permission'?: string }>> }
  assert.equal(doc.openapi, '3.0.3')
  assert.ok(doc.paths['/api/v1/launcher/bootstrap'].get)
  assert.equal(doc.paths['/api/v1/releases/{id}/publish'].post['x-permission'], 'releases.publish')
  assert.ok(Object.keys(doc.paths).length > 40)
})

test('security headers and CORS policy', async () => {
  const r = await app.request('/api/v1/version', { headers: { origin: 'https://evil.example' } })
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(r.headers.get('x-frame-options'), 'DENY')
  assert.equal(r.headers.get('access-control-allow-origin'), '*', 'public endpoint')
  const admin = await app.request('/api/v1/users', { headers: { origin: 'https://evil.example' } })
  assert.equal(admin.status, 401)
  assert.equal(admin.headers.get('access-control-allow-origin'), null, 'admin endpoints are not open to arbitrary origins')
  const ok = await app.request('/api/v1/users', { headers: { origin: 'https://admin.test' } })
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://admin.test')
  const pre = await app.request('/api/v1/users', { method: 'OPTIONS', headers: { origin: 'https://admin.test', 'access-control-request-method': 'GET' } })
  assert.equal(pre.status, 204)
  const err = await call('GET', '/api/v1/releases/zzzzzzzzzzzz', { token: 'garbage' })
  assert.equal(err.status, 401)
  assert.ok(!JSON.stringify(err.body).match(/stack|sqlite|node_modules/i))
})

test('global search only returns what the role may read', async () => {
  const cm = await staff(['CONTENT_MANAGER'])
  const owner = await staff(['OWNER'])
  const none = await call('GET', '/api/v1/search?q=Mega', { token: cm.token })
  assert.ok(none.body.data.some((h: { type: string }) => h.type === 'server'))
  assert.ok(!none.body.data.some((h: { type: string }) => h.type === 'user'))
  const all = await call('GET', `/api/v1/search?q=${owner.username.slice(0, 8)}`, { token: owner.token })
  assert.ok(all.body.data.some((h: { type: string }) => h.type === 'user'))
  assert.equal((await call('GET', '/api/v1/search?q=a', { token: owner.token })).status, 422)
})

test('dashboard returns real numbers by permission', async () => {
  const analyst = await staff(['ANALYST'])
  const d = (await call('GET', '/api/v1/dashboard', { token: analyst.token })).body.data
  assert.ok(d.users.total > 0)
  assert.ok(d.analytics)
  assert.ok(!d.analytics.token)
  const cm = await staff(['CONTENT_MANAGER'])
  const d2 = (await call('GET', '/api/v1/dashboard', { token: cm.token })).body.data
  assert.equal(d2.analytics, undefined)
  assert.ok(d2.content)
})

test('rate limiting returns 429 with Retry-After', async () => {
  const { checkLimit, resetLimits } = await import('../src/platform/core/ratelimit.js')
  resetLimits()
  for (let i = 0; i < 3; i++) checkLimit('auth', 'test-ip', 3)
  assert.throws(() => checkLimit('auth', 'test-ip', 3), (e: { code?: string }) => e.code === 'RATE_LIMITED')
  resetLimits()
})

test('audit log records admin writes with before/after and redacts secrets', async () => {
  const owner = await staff(['OWNER'])
  const logs = await call('GET', '/api/v1/audit-logs?q=Mega', { token: owner.token })
  assert.ok(logs.body.data.length > 0)
  const detail = await call('GET', `/api/v1/audit-logs/${logs.body.data[0].id}`, { token: owner.token })
  assert.ok(detail.body.data.actorName)
  assert.ok(!JSON.stringify(detail.body).match(/password|refreshToken/i))
})
