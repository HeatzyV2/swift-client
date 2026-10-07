import type { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../../../db.js'
import { hashPassword, verifyPassword } from '../../../auth.js'
import { audit } from '../../core/audit.js'
import {
  assertNotLocked, clearFailures, fakeVerify, issueSession, recordFailure, revokeAllSessions,
  revokeByRefreshToken, revokeSession, rotateSession, userRoles,
} from '../../core/auth.js'
import { AppError, badRequest, forbidden, notFound, unauthorized } from '../../core/errors.js'
import { emit } from '../../core/events.js'
import { actorOf, defineRoute, ok, paged, pageQuery, type PEnv } from '../../core/http.js'
import { canManageRole, isRole, maxRank, ROLE_PERMISSIONS, ROLES, ROLE_RANK, type Role } from '../../core/rbac.js'
import { likeEscape } from '../../core/util.js'
import { countOwners, describeUser, findUser, me, setRoles, type UserRowFull } from './service.js'

const role = z.enum(ROLES)

export function registerIam(app: Hono<PEnv>) {
  // --- Auth ------------------------------------------------------------------------------------------

  defineRoute(app, {
    method: 'post', path: '/auth/login', tag: 'Auth', auth: 'public', rate: 'auth', summary: 'Sign in with a Swift account that holds a platform role',
    body: z.object({ username: z.string().trim().min(1).max(64), password: z.string().min(1).max(256) }),
  }, async (c, { body }) => {
    const ip = c.get('ip')
    assertNotLocked(body.username, ip)
    const row = db.prepare('SELECT id, password_hash, disabled_at FROM users WHERE username = ? COLLATE NOCASE').get(body.username) as { id: string, password_hash: string, disabled_at: string | null } | undefined
    const valid = row ? await verifyPassword(row.password_hash, body.password) : (await fakeVerify(body.password), false)
    if (!row || !valid || row.disabled_at) {
      recordFailure(body.username, ip)
      audit(c, 'auth.login_failed', 'user', row?.id ?? null, { summary: `failed sign-in for "${body.username.slice(0, 40)}"` })
      throw unauthorized('Invalid username or password')
    }
    if (!userRoles(row.id).length) throw forbidden('This account has no access to the admin platform')
    clearFailures(body.username, ip)
    const tokens = await issueSession(row.id, { userAgent: c.req.header('user-agent'), ip })
    c.set('actor', { id: row.id, username: body.username, roles: [], permissions: new Set(), sessionId: '' })
    audit(c, 'auth.login', 'user', row.id, { summary: 'signed in' })
    return ok({ ...tokens, user: me(findUser(row.id)!) })
  })

  defineRoute(app, {
    method: 'post', path: '/auth/refresh', tag: 'Auth', auth: 'public', rate: 'auth', summary: 'Exchange a refresh token for a new token pair (rotation)',
    body: z.object({ refreshToken: z.string().min(20).max(200) }),
  }, async (c, { body }) => {
    const { tokens, userId } = await rotateSession(body.refreshToken, { userAgent: c.req.header('user-agent'), ip: c.get('ip') })
    return ok({ ...tokens, user: me(findUser(userId)!) })
  })

  defineRoute(app, { method: 'post', path: '/auth/logout', tag: 'Auth', auth: 'user', summary: 'End the current session',
    body: z.object({ refreshToken: z.string().max(200).optional() }).optional() },
  (c, { actor, body }) => {
    revokeSession(actor!.sessionId)
    if (body?.refreshToken) revokeByRefreshToken(body.refreshToken)
    audit(c, 'auth.logout', 'user', actor!.id)
    return ok({ loggedOut: true })
  })

  defineRoute(app, { method: 'post', path: '/auth/logout-all', tag: 'Auth', auth: 'user', summary: 'End every session of the current user' }, (c, { actor }) => {
    revokeAllSessions(actor!.id)
    audit(c, 'auth.logout_all', 'user', actor!.id)
    return ok({ loggedOut: true })
  })

  defineRoute(app, { method: 'get', path: '/auth/me', tag: 'Auth', auth: 'user', summary: 'Current user, roles and permissions' }, (_c, { actor }) => {
    const u = findUser(actor!.id)
    if (!u) throw notFound('User')
    return ok(me(u))
  })

  defineRoute(app, {
    method: 'post', path: '/auth/change-password', tag: 'Auth', auth: 'user', rate: 'auth', summary: 'Change the password and sign out everywhere',
    body: z.object({ currentPassword: z.string().min(1).max(256), newPassword: z.string().min(10, 'At least 10 characters').max(256) }),
  }, async (c, { actor, body }) => {
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(actor!.id) as { password_hash: string }
    if (!(await verifyPassword(row.password_hash, body.currentPassword))) throw new AppError(403, 'INVALID_PASSWORD', 'Current password is incorrect')
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(body.newPassword), actor!.id)
    revokeAllSessions(actor!.id)
    audit(c, 'auth.password_changed', 'user', actor!.id)
    return ok({ changed: true })
  })

  // --- Users and roles ---------------------------------------------------------------------------------

  defineRoute(app, { method: 'get', path: '/roles', tag: 'Users', auth: 'users.read', summary: 'Role and permission matrix' }, () =>
    ok(ROLES.map(r => ({ role: r, rank: ROLE_RANK[r], permissions: [...ROLE_PERMISSIONS[r]] }))))

  defineRoute(app, {
    method: 'get', path: '/users', tag: 'Users', auth: 'users.read', summary: 'List users',
    query: pageQuery.extend({ role: role.optional(), staff: z.enum(['0', '1']).optional() }),
  }, (_c, { query }) => {
    const where: string[] = []
    const args: unknown[] = []
    if (query.q) {
      where.push("(u.username LIKE ? ESCAPE '\\' OR u.mc_username LIKE ? ESCAPE '\\')")
      const p = `%${likeEscape(query.q)}%`
      args.push(p, p)
    }
    if (query.role) { where.push('EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = ?)'); args.push(query.role) }
    if (query.staff === '1') where.push('EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id)')
    const w = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const total = (db.prepare(`SELECT COUNT(*) AS n FROM users u ${w}`).get(...args) as { n: number }).n
    const rows = db.prepare(`SELECT u.id, u.username, u.mc_username, u.mc_uuid, u.created_at, u.last_seen, u.disabled_at FROM users u ${w} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`)
      .all(...args, query.limit, (query.page - 1) * query.limit) as UserRowFull[]
    return paged(rows.map(describeUser), total, query.page, query.limit)
  })

  defineRoute(app, { method: 'get', path: '/users/:id', tag: 'Users', auth: 'users.read', summary: 'User detail' }, (_c, { params }) => {
    const u = findUser(params.id)
    if (!u) throw notFound('User')
    return ok(describeUser(u))
  })

  defineRoute(app, {
    method: 'put', path: '/users/:id/roles', tag: 'Users', auth: 'users.manage', summary: 'Replace the roles of a user',
    body: z.object({ roles: z.array(role).max(ROLES.length) }),
  }, (c, { params, body }) => {
    const actor = actorOf(c)
    const target = findUser(params.id)
    if (!target) throw notFound('User')
    if (target.id === actor.id) throw forbidden('You cannot change your own roles')
    const before = userRoles(target.id)
    const next = [...new Set(body.roles)] as Role[]
    const changed = [...before.filter(r => !next.includes(r)), ...next.filter(r => !before.includes(r))]
    for (const r of changed) if (!canManageRole(actor.roles, r)) throw forbidden(`You cannot grant or revoke ${r}`)
    if (before.length && maxRank(before) >= maxRank(actor.roles) && maxRank(actor.roles) < ROLE_RANK.OWNER) throw forbidden('You cannot modify a user of equal or higher rank')
    if (before.includes('OWNER') && !next.includes('OWNER') && countOwners() <= 1) throw badRequest('The last OWNER cannot be removed')
    setRoles(target.id, next, actor.id)
    audit(c, 'user.roles_changed', 'user', target.id, { summary: `${target.username}: ${before.join(',') || '-'} -> ${next.join(',') || '-'}`, before: { roles: before }, after: { roles: next } })
    emit('user.role_changed', { userId: target.id, username: target.username, roles: next })
    return ok(describeUser(findUser(target.id)!))
  })

  defineRoute(app, {
    method: 'post', path: '/users/:id/disabled', tag: 'Users', auth: 'users.manage', summary: 'Disable or re-enable an account (revokes its sessions)',
    body: z.object({ disabled: z.boolean() }),
  }, (c, { params, body }) => {
    const actor = actorOf(c)
    const target = findUser(params.id)
    if (!target) throw notFound('User')
    if (target.id === actor.id) throw forbidden('You cannot disable your own account')
    const rank = maxRank(userRoles(target.id))
    if (rank && rank >= maxRank(actor.roles) && maxRank(actor.roles) < ROLE_RANK.OWNER) throw forbidden('You cannot disable a user of equal or higher rank')
    db.prepare('UPDATE users SET disabled_at = ? WHERE id = ?').run(body.disabled ? new Date().toISOString() : null, target.id)
    if (body.disabled) revokeAllSessions(target.id)
    audit(c, body.disabled ? 'user.disabled' : 'user.enabled', 'user', target.id, { summary: target.username })
    return ok(describeUser(findUser(target.id)!))
  })

  // --- Audit log ---------------------------------------------------------------------------------------

  defineRoute(app, {
    method: 'get', path: '/audit-logs', tag: 'Audit', auth: 'audit.read', summary: 'Audit log',
    query: pageQuery.extend({ actorId: z.string().max(40).optional(), action: z.string().max(60).optional(), entityType: z.string().max(40).optional(), from: z.string().max(40).optional(), to: z.string().max(40).optional() }),
  }, (_c, { query }) => {
    const where: string[] = []
    const args: unknown[] = []
    if (query.actorId) { where.push('actor_id = ?'); args.push(query.actorId) }
    if (query.action) { where.push("action LIKE ? ESCAPE '\\'"); args.push(`${likeEscape(query.action)}%`) }
    if (query.entityType) { where.push('entity_type = ?'); args.push(query.entityType) }
    if (query.from) { where.push('at >= ?'); args.push(query.from) }
    if (query.to) { where.push('at <= ?'); args.push(query.to) }
    if (query.q) { where.push("(summary LIKE ? ESCAPE '\\' OR actor_name LIKE ? ESCAPE '\\' OR entity_id = ?)"); const p = `%${likeEscape(query.q)}%`; args.push(p, p, query.q) }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const total = (db.prepare(`SELECT COUNT(*) AS n FROM audit_logs ${w}`).get(...args) as { n: number }).n
    const rows = db.prepare(`SELECT id, at, actor_id AS actorId, actor_name AS actorName, action, entity_type AS entityType, entity_id AS entityId, summary, ip, request_id AS requestId
      FROM audit_logs ${w} ORDER BY at DESC LIMIT ? OFFSET ?`).all(...args, query.limit, (query.page - 1) * query.limit)
    return paged(rows, total, query.page, query.limit)
  })

  defineRoute(app, { method: 'get', path: '/audit-logs/:id', tag: 'Audit', auth: 'audit.read', summary: 'Audit entry with before/after state' }, (_c, { params }) => {
    const r = db.prepare('SELECT * FROM audit_logs WHERE id = ?').get(params.id) as Record<string, unknown> | undefined
    if (!r) throw notFound('Audit entry')
    return ok({
      id: r.id, at: r.at, actorId: r.actor_id, actorName: r.actor_name, action: r.action, entityType: r.entity_type, entityId: r.entity_id,
      summary: r.summary, ip: r.ip, requestId: r.request_id,
      before: r.before_json ? JSON.parse(r.before_json as string) : null, after: r.after_json ? JSON.parse(r.after_json as string) : null,
    })
  })

  // --- Notifications -----------------------------------------------------------------------------------

  defineRoute(app, { method: 'get', path: '/notifications', tag: 'Notifications', auth: 'user', summary: 'Admin notifications for the current user' }, (_c, { actor }) => {
    const perms = [...actor!.permissions]
    const marks = perms.map(() => '?').join(',')
    const rows = db.prepare(`SELECT n.id, n.at, n.level, n.title, n.body, n.link,
        EXISTS (SELECT 1 FROM notification_reads r WHERE r.notification_id = n.id AND r.user_id = ?) AS read
      FROM notifications n WHERE n.permission IS NULL ${perms.length ? `OR n.permission IN (${marks})` : ''}
      ORDER BY n.at DESC LIMIT 50`).all(actor!.id, ...perms) as { read: number }[]
    return ok({ items: rows.map(r => ({ ...r, read: !!r.read })), unread: rows.filter(r => !r.read).length })
  })

  defineRoute(app, {
    method: 'post', path: '/notifications/read', tag: 'Notifications', auth: 'user', summary: 'Mark notifications as read',
    body: z.object({ ids: z.array(z.string().max(40)).max(100).optional() }),
  }, (_c, { actor, body }) => {
    const ids = body.ids ?? (db.prepare('SELECT id FROM notifications ORDER BY at DESC LIMIT 100').all() as { id: string }[]).map(r => r.id)
    const ins = db.prepare('INSERT OR IGNORE INTO notification_reads (user_id, notification_id) SELECT ?, id FROM notifications WHERE id = ?')
    db.transaction(() => { for (const id of ids) ins.run(actor!.id, id) })()
    return ok({ marked: ids.length })
  })
}

export { isRole }
