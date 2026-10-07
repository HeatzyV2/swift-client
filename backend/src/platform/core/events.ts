// Domain events: modules emit, integrations (webhooks, notifications) subscribe. Handlers never throw
// into the caller: a failing webhook must not fail the admin action that triggered it.
import { db } from '../../db.js'
import { log, errFields } from './logger.js'
import { newId, nowIso } from './util.js'

export const EVENT_NAMES = [
  'home.published', 'home.rolled_back',
  'news.published', 'announcement.created',
  'release.published', 'release.revoked',
  'maintenance.changed',
  'server.created', 'campaign.created',
  'crash.new_group',
  'user.role_changed',
  'test.ping',
] as const
export type EventName = typeof EVENT_NAMES[number]

type Handler = (event: EventName, data: Record<string, unknown>) => void
const handlers: Handler[] = []

export function onEvent(h: Handler) {
  handlers.push(h)
}

export function emit(event: EventName, data: Record<string, unknown> = {}): void {
  for (const h of handlers) {
    try {
      h(event, data)
    } catch (e) {
      log.error('event handler failed', { event, ...errFields(e) })
    }
  }
}

/** Admin notification (bell icon). `permission` limits who sees it; null = every platform user. */
export function notify(level: 'info' | 'success' | 'warning' | 'critical', title: string, body?: string, link?: string, permission?: string): void {
  db.prepare('INSERT INTO notifications (id, at, level, title, body, link, permission) VALUES (?,?,?,?,?,?,?)')
    .run(newId(14), nowIso(), level, title.slice(0, 160), body?.slice(0, 500) ?? null, link ?? null, permission ?? null)
}
