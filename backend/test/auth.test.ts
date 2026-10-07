import assert from 'node:assert/strict'
import { test } from 'node:test'
import { call, staff, db } from './helpers.js'

test('envelope: success and error shapes, request id header', async () => {
  const ok = await call('GET', '/api/v1/version')
  assert.equal(ok.status, 200)
  assert.equal(ok.body.success, true)
  assert.ok(ok.body.meta.requestId)
  assert.ok(ok.headers.get('x-request-id'))
  const nf = await call('GET', '/api/v1/nope')
  assert.equal(nf.status, 404)
  assert.deepEqual(Object.keys(nf.body.error).sort(), ['code', 'message'])
  assert.equal(nf.body.error.code, 'NOT_FOUND')
})

test('migrations are recorded and /ready reports healthy', async () => {
  const n = (db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get() as { n: number }).n
  assert.ok(n >= 6)
  const r = await call('GET', '/ready')
  assert.equal(r.status, 200)
  assert.equal(r.body.ready, true)
})

test('protected routes need a token; legacy launcher tokens are rejected', async () => {
  assert.equal((await call('GET', '/api/v1/auth/me')).status, 401)
  const reg = await call('POST', '/api/auth/register', { body: { username: 'legacy_user', password: 'legacy-password-1' } })
  const legacyToken = reg.body.token as string
  assert.equal((await call('GET', '/api/v1/auth/me', { token: legacyToken })).status, 401)
  // The legacy API still works with it
  assert.equal((await call('GET', '/api/me', { token: legacyToken })).status, 200)
})

test('login requires a platform role', async () => {
  await call('POST', '/api/auth/register', { body: { username: 'norole', password: 'some-long-password' } })
  const res = await call('POST', '/api/v1/auth/login', { body: { username: 'norole', password: 'some-long-password' } })
  assert.equal(res.status, 403)
})

test('refresh rotates tokens and reuse revokes the session', async () => {
  const u = await staff(['ADMIN'])
  const r1 = await call('POST', '/api/v1/auth/refresh', { body: { refreshToken: u.refresh } })
  assert.equal(r1.status, 200)
  const newRefresh = r1.body.data.refreshToken as string
  assert.notEqual(newRefresh, u.refresh)
  // replaying the old refresh token is an attack: whole family dies
  const replay = await call('POST', '/api/v1/auth/refresh', { body: { refreshToken: u.refresh } })
  assert.equal(replay.status, 401)
  const after = await call('POST', '/api/v1/auth/refresh', { body: { refreshToken: newRefresh } })
  assert.equal(after.status, 401)
  assert.equal((await call('GET', '/api/v1/auth/me', { token: r1.body.data.accessToken })).status, 401)
})

test('logout revokes the access token immediately', async () => {
  const u = await staff(['ANALYST'])
  assert.equal((await call('GET', '/api/v1/auth/me', { token: u.token })).status, 200)
  assert.equal((await call('POST', '/api/v1/auth/logout', { token: u.token, body: {} })).status, 200)
  assert.equal((await call('GET', '/api/v1/auth/me', { token: u.token })).status, 401)
})

test('brute force: account locks after repeated failures', async () => {
  const u = await staff(['SUPPORT'])
  for (let i = 0; i < 3; i++) {
    const r = await call('POST', '/api/v1/auth/login', { body: { username: u.username, password: 'wrong-password' } })
    assert.equal(r.status, 401)
  }
  const locked = await call('POST', '/api/v1/auth/login', { body: { username: u.username, password: u.password } })
  assert.equal(locked.status, 429)
  assert.equal(locked.body.error.code, 'ACCOUNT_LOCKED')
  assert.ok(locked.headers.get('retry-after'))
})

test('password change signs out everywhere', async () => {
  const u = await staff(['ADMIN'])
  const bad = await call('POST', '/api/v1/auth/change-password', { token: u.token, body: { currentPassword: 'nope-nope-nope', newPassword: 'a-brand-new-password' } })
  assert.equal(bad.status, 403)
  const ok = await call('POST', '/api/v1/auth/change-password', { token: u.token, body: { currentPassword: u.password, newPassword: 'a-brand-new-password' } })
  assert.equal(ok.status, 200)
  assert.equal((await call('GET', '/api/v1/auth/me', { token: u.token })).status, 401)
  const login = await call('POST', '/api/v1/auth/login', { body: { username: u.username, password: 'a-brand-new-password' } })
  assert.equal(login.status, 200)
})

test('disabled accounts cannot sign in, on the platform or the legacy API', async () => {
  const owner = await staff(['OWNER'])
  const victim = await staff(['CONTENT_MANAGER'])
  const r = await call('POST', `/api/v1/users/${victim.id}/disabled`, { token: owner.token, body: { disabled: true } })
  assert.equal(r.status, 200)
  assert.equal((await call('GET', '/api/v1/auth/me', { token: victim.token })).status, 401)
  assert.equal((await call('POST', '/api/v1/auth/login', { body: { username: victim.username, password: victim.password } })).status, 401)
  assert.equal((await call('POST', '/api/auth/login', { body: { username: victim.username, password: victim.password } })).status, 401)
})
