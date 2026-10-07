import assert from 'node:assert/strict'
import { test } from 'node:test'
import { call, staff } from './helpers.js'
import { PERMISSIONS, ROLE_PERMISSIONS, canManageRole } from '../src/platform/core/rbac.js'

test('role matrix: OWNER and ADMIN hold everything, others are scoped', () => {
  assert.equal(ROLE_PERMISSIONS.OWNER.length, PERMISSIONS.length)
  assert.ok(!ROLE_PERMISSIONS.CONTENT_MANAGER.includes('releases.publish'))
  assert.ok(ROLE_PERMISSIONS.RELEASE_MANAGER.includes('releases.publish'))
  assert.ok(!ROLE_PERMISSIONS.ANALYST.includes('home.write'))
  assert.ok(ROLE_PERMISSIONS.SUPPORT.includes('users.read'))
  assert.ok(!ROLE_PERMISSIONS.SUPPORT.includes('users.manage'))
})

test('role management respects rank', () => {
  assert.equal(canManageRole(['OWNER'], 'ADMIN'), true)
  assert.equal(canManageRole(['ADMIN'], 'OWNER'), false)
  assert.equal(canManageRole(['ADMIN'], 'ADMIN'), false)
  assert.equal(canManageRole(['ADMIN'], 'SUPPORT'), true)
  assert.equal(canManageRole(['CONTENT_MANAGER'], 'ANALYST'), false)
})

test('endpoints enforce permissions (403) and allow the right role', async () => {
  const cm = await staff(['CONTENT_MANAGER'])
  const analyst = await staff(['ANALYST'])
  const rm = await staff(['RELEASE_MANAGER'])
  assert.equal((await call('GET', '/api/v1/news', { token: cm.token })).status, 200)
  assert.equal((await call('GET', '/api/v1/releases', { token: cm.token })).status, 403)
  assert.equal((await call('GET', '/api/v1/analytics/overview', { token: cm.token })).status, 403)
  assert.equal((await call('GET', '/api/v1/analytics/overview', { token: analyst.token })).status, 200)
  assert.equal((await call('POST', '/api/v1/home/publish', { token: analyst.token, body: {} })).status, 403)
  assert.equal((await call('GET', '/api/v1/releases', { token: rm.token })).status, 200)
  assert.equal((await call('GET', '/api/v1/audit-logs', { token: rm.token })).status, 403)
  assert.equal((await call('GET', '/api/v1/users', { token: rm.token })).status, 403)
})

test('role assignment: no self-edit, no escalation, last owner protected', async () => {
  const owner = await staff(['OWNER'])
  const admin = await staff(['ADMIN'])
  const target = await staff(['SUPPORT'])
  assert.equal((await call('PUT', `/api/v1/users/${owner.id}/roles`, { token: owner.token, body: { roles: ['ADMIN'] } })).status, 403)
  assert.equal((await call('PUT', `/api/v1/users/${target.id}/roles`, { token: admin.token, body: { roles: ['OWNER'] } })).status, 403)
  const ok = await call('PUT', `/api/v1/users/${target.id}/roles`, { token: admin.token, body: { roles: ['SUPPORT', 'ANALYST'] } })
  assert.equal(ok.status, 200)
  assert.deepEqual(ok.body.data.roles.sort(), ['ANALYST', 'SUPPORT'])
  const logs = await call('GET', '/api/v1/audit-logs?action=user.roles_changed', { token: owner.token })
  assert.ok(logs.body.data.length >= 1)
})

test('validation errors use the 422 envelope', async () => {
  const cm = await staff(['CONTENT_MANAGER'])
  const r = await call('POST', '/api/v1/news', { token: cm.token, body: { title: {}, summary: { en: 'x' } } })
  assert.equal(r.status, 422)
  assert.equal(r.body.error.code, 'VALIDATION_ERROR')
  assert.ok(Array.isArray(r.body.error.details))
  const bad = await call('POST', '/api/v1/news', { token: cm.token, raw: '{nope', headers: { 'content-type': 'application/json' } })
  assert.equal(bad.status, 400)
})
