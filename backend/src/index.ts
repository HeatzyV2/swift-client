import { createAdaptorServer } from '@hono/node-server'
import net from 'node:net'
import { sniffTls, tlsFiles } from './tls.js'
import { env } from './env.js'
import { createApp } from './app.js'
import { startRelay } from './relay.js'
import { startCleanupJob } from './cleanup.js'
import { startPlatformJobs } from './platform/jobs.js'
import { log } from './platform/core/logger.js'

const app = createApp()

if (env.insecureSecret) {
  log.warn('JWT_SECRET is not set: legacy tokens use an insecure default and the admin platform sign-in is disabled. Set JWT_SECRET.')
}

startCleanupJob()
startPlatformJobs()
startRelay()

// HTTPS and plain HTTP on the same port (plain HTTP is kept for older clients).
const httpServer = createAdaptorServer({ fetch: app.fetch })
const listener = net.createServer(sniffTls(
  (sock) => httpServer.emit('connection', sock),
  (sock) => httpServer.emit('connection', sock),
))
listener.listen(env.port, env.host, () => {
  console.log(`Swift Client API listening on ${env.host}:${env.port} (${env.publicUrl}), env=${env.appEnv}${tlsFiles() ? ', HTTPS + HTTP' : ', HTTP only (no TLS certificate)'}`)
})

function shutdown() {
  listener.close()
  setTimeout(() => process.exit(0), 500).unref()
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
