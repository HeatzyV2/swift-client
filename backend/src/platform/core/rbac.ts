// Roles and permissions. The matrix lives in code (reviewed, versioned, tested); only the assignment of
// roles to users is stored in the database (user_roles).
export const ROLES = ['OWNER', 'ADMIN', 'CONTENT_MANAGER', 'SERVER_MANAGER', 'RELEASE_MANAGER', 'ANALYST', 'SUPPORT'] as const
export type Role = typeof ROLES[number]

export const PERMISSIONS = [
  'home.read', 'home.write', 'home.publish',
  'news.read', 'news.write', 'news.publish',
  'announcements.read', 'announcements.write',
  'servers.read', 'servers.write',
  'partners.read', 'partners.write',
  'releases.read', 'releases.write', 'releases.publish',
  'assets.read', 'assets.write',
  'analytics.read', 'diagnostics.read', 'diagnostics.write',
  'config.read', 'config.write',
  'settings.read', 'settings.write',
  'users.read', 'users.manage',
  'audit.read',
  'webhooks.manage',
] as const
export type Permission = typeof PERMISSIONS[number]

const read = (...areas: string[]) => areas.map(a => `${a}.read`) as Permission[]
const all = (area: string) => PERMISSIONS.filter(p => p.startsWith(`${area}.`))

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  OWNER: PERMISSIONS,
  ADMIN: PERMISSIONS,
  CONTENT_MANAGER: [...all('home'), ...all('news'), ...all('announcements'), ...all('assets'), ...read('servers', 'partners', 'config')],
  SERVER_MANAGER: [...all('servers'), ...all('partners'), ...all('assets'), ...read('home', 'news', 'analytics')],
  RELEASE_MANAGER: [...all('releases'), ...read('news', 'config', 'settings', 'assets'), 'diagnostics.read', 'config.write'],
  ANALYST: [...read('analytics', 'diagnostics', 'home', 'news', 'servers', 'partners', 'releases', 'announcements', 'config')],
  SUPPORT: [...read('users', 'diagnostics', 'news', 'servers', 'announcements', 'releases'), 'diagnostics.write'],
}

/** Higher rank can grant/revoke lower ranks. Same rank cannot manage each other (except OWNER over all). */
export const ROLE_RANK: Record<Role, number> = {
  OWNER: 100, ADMIN: 80, CONTENT_MANAGER: 40, SERVER_MANAGER: 40, RELEASE_MANAGER: 40, ANALYST: 40, SUPPORT: 40,
}

export const isRole = (v: string): v is Role => (ROLES as readonly string[]).includes(v)

export function permissionsFor(roles: Role[]): Set<string> {
  const set = new Set<string>()
  for (const r of roles) for (const p of ROLE_PERMISSIONS[r]) set.add(p)
  return set
}

export function maxRank(roles: Role[]): number {
  return roles.reduce((m, r) => Math.max(m, ROLE_RANK[r]), 0)
}

/** May an actor holding `actorRoles` grant or revoke `target`? */
export function canManageRole(actorRoles: Role[], target: Role): boolean {
  const rank = maxRank(actorRoles)
  if (rank >= ROLE_RANK.OWNER) return true
  return rank > ROLE_RANK[target]
}
