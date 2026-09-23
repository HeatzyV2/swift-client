import * as argon2 from 'argon2'
import { SignJWT, jwtVerify } from 'jose'
import { nanoid } from 'nanoid'
import type { Context, Next } from 'hono'
import { db, type UserRow } from './db.js'
import { env } from './env.js'

const secret = () => new TextEncoder().encode(env.jwtSecret)

export type SessionUser = {
  id: string
  username: string
  mc_uuid: string | null
  mc_username: string | null
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id })
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password)
  } catch {
    return false
  }
}

export async function signToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    sub: user.id,
    username: user.username,
    mc_uuid: user.mc_uuid,
    mc_username: user.mc_username,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret())
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    if (typeof payload.sub !== 'string' || typeof payload.username !== 'string') return null
    return {
      id: payload.sub,
      username: payload.username,
      mc_uuid: typeof payload.mc_uuid === 'string' ? payload.mc_uuid : null,
      mc_username: typeof payload.mc_username === 'string' ? payload.mc_username : null,
    }
  } catch {
    return null
  }
}

export function publicUser(row: UserRow) {
  return {
    id: row.id,
    username: row.username,
    mc_uuid: row.mc_uuid,
    mc_username: row.mc_username,
    created_at: row.created_at,
  }
}

export function createUserId(): string {
  return nanoid(16)
}

export function findUserByUsername(username: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username) as UserRow | undefined
}

export function findUserById(id: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
}

export type AuthVariables = { user: SessionUser }

export async function requireAuth(c: Context<{ Variables: AuthVariables }>, next: Next) {
  const header = c.req.header('authorization') ?? ''
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
  if (!token) return c.json({ message: 'sign in required' }, 401)
  const user = await verifyToken(token)
  if (!user) return c.json({ message: 'invalid or expired session' }, 401)
  c.set('user', user)
  await next()
}

export async function optionalAuth(c: Context<{ Variables: Partial<AuthVariables> }>, next: Next) {
  const header = c.req.header('authorization') ?? ''
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
  if (token) {
    const user = await verifyToken(token)
    if (user) c.set('user', user)
  }
  await next()
}
