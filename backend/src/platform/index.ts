// Swift Platform entry: migrations + the /api/v1 router.
import { Hono } from 'hono'
import { db } from '../db.js'
import { runMigrations } from './core/migrate.js'
import { AppError, notFound } from './core/errors.js'
import { errorBody, type PEnv } from './core/http.js'
import { migrations } from './migrations.js'
import { registerAdmin } from './modules/admin/admin.js'
import { registerAnalytics } from './modules/analytics/analytics.js'
import { registerAssets } from './modules/assets/routes.js'
import { registerHome } from './modules/cms/home.js'
import { registerAnnouncements, registerNews } from './modules/cms/news.js'
import { registerConfig } from './modules/config/routes.js'
import { registerWebhooks, startWebhookDispatch } from './modules/integrations/webhooks.js'
import { registerIam } from './modules/iam/routes.js'
import { registerLauncher } from './modules/launcher/launcher.js'
import { registerReleases } from './modules/releases/releases.js'
import { registerServers } from './modules/servers/servers.js'
import { registerSystem } from './modules/system/system.js'

let started = false

export function initPlatform() {
  runMigrations(db, migrations)
  if (!started) {
    started = true
    startWebhookDispatch()
  }
}

export function createV1(): Hono<PEnv> {
  const v1 = new Hono<PEnv>()
  registerSystem(v1)
  registerIam(v1)
  registerLauncher(v1)
  registerHome(v1)
  registerNews(v1)
  registerAnnouncements(v1)
  registerServers(v1)
  registerAssets(v1)
  registerConfig(v1)
  registerReleases(v1)
  registerAnalytics(v1)
  registerWebhooks(v1)
  registerAdmin(v1)
  v1.notFound((c) => c.json(errorBody('NOT_FOUND', 'Route not found', c.get('requestId')), 404))
  return v1
}

export { AppError, notFound }
