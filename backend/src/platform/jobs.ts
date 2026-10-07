// Background work of the platform: scheduled publications, webhook deliveries, retention purges.
import { errFields, log } from './core/logger.js'
import { purgeAudit } from './core/audit.js'
import { purgeExpiredTokens } from './core/auth.js'
import { promoteScheduled } from './modules/cms/news.js'
import { purgeAnalytics } from './modules/analytics/analytics.js'
import { processDeliveries, purgeDeliveries } from './modules/integrations/webhooks.js'

export function runMaintenance() {
  for (const job of [purgeAnalytics, purgeAudit, purgeExpiredTokens, purgeDeliveries]) {
    try { job() } catch (e) { log.error('maintenance job failed', { job: job.name, ...errFields(e) }) }
  }
}

export function startPlatformJobs(): () => void {
  const fast = setInterval(() => {
    try { promoteScheduled() } catch (e) { log.error('scheduler failed', errFields(e)) }
    processDeliveries().catch(e => log.error('webhook worker failed', errFields(e)))
  }, 30_000)
  const slow = setInterval(runMaintenance, 3_600_000)
  fast.unref()
  slow.unref()
  runMaintenance()
  return () => { clearInterval(fast); clearInterval(slow) }
}
