import { db } from '../../../db.js'
import { userRoles } from '../../core/auth.js'
import { permissionsFor, type Role } from '../../core/rbac.js'
import { nowIso } from '../../core/util.js'

export type UserRowFull = {
  id: string, username: string, mc_username: string | null, mc_uuid: string | null, created_at: string,
  last_seen: string | null, disabled_at: string | null,
}

export function findUser(id: string): UserRowFull | undefined {
  return db.prepare('SELECT id, username, mc_username, mc_uuid, created_at, last_seen, disabled_at FROM users WHERE id = ?').get(id) as UserRowFull | undefined
}

export function describeUser(u: UserRowFull) {
  const roles = userRoles(u.id)
  return {
    id: u.id,
    username: u.username,
    minecraft: u.mc_username ? { username: u.mc_username, uuid: u.mc_uuid } : null,
    createdAt: u.created_at,
    lastSeen: u.last_seen,
    disabled: !!u.disabled_at,
    roles,
  }
}

export function me(u: UserRowFull) {
  const roles = userRoles(u.id)
  return { ...describeUser(u), permissions: [...permissionsFor(roles)].sort() }
}

export function setRoles(userId: string, roles: Role[], grantedBy: string | null): void {
  db.transaction(() => {
    db.prepare('DELETE FROM user_roles WHERE user_id = ?').run(userId)
    const ins = db.prepare('INSERT INTO user_roles (user_id, role, granted_by, created_at) VALUES (?,?,?,?)')
    for (const r of roles) ins.run(userId, r, grantedBy, nowIso())
  })()
}

export function countOwners(): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM user_roles ur JOIN users u ON u.id = ur.user_id WHERE ur.role = 'OWNER' AND u.disabled_at IS NULL").get() as { n: number }).n
}
