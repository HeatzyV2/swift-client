import assert from 'node:assert/strict'
import { test } from 'node:test'
import { call, staff, db } from './helpers.js'

test('online players: only recent heartbeats count', async () => {
  const fresh = await staff([], 'correct-horse-battery-1')
  const stale = await staff([], 'correct-horse-battery-2')
  db.prepare('UPDATE users SET last_seen = NULL').run()
  db.prepare('UPDATE users SET last_seen = ? WHERE id = ?').run(new Date().toISOString(), fresh.id)
  db.prepare('UPDATE users SET last_seen = ? WHERE id = ?').run(new Date(Date.now() - 5 * 60_000).toISOString(), stale.id)

  const res = await call('GET', '/api/players/online')
  assert.equal(res.status, 200)
  assert.deepEqual(res.body, { online: 1 })
})
