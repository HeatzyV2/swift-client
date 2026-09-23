import { env } from './env.js'
import { purgeExpiredMedia } from './routes/social.js'
import { purgeExpiredShares } from './routes/share.js'

export function startCleanupJob() {
  const run = () => {
    try {
      const media = purgeExpiredMedia()
      const shares = purgeExpiredShares()
      if (media || shares) {
        console.log(`[cleanup] purged media=${media} shares=${shares}`)
      }
    } catch (e) {
      console.error('[cleanup] failed', e)
    }
  }
  run()
  return setInterval(run, env.cleanupIntervalMs)
}
