// Local preview: throw-away data dir, a seeded OWNER (preview / preview-password-1) and the real server on :18788.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = mkdtempSync(join(tmpdir(), 'swift-preview-'))
const env = { ...process.env, DATA_DIR: dir, PORT: '18788', HOST: '127.0.0.1', JWT_SECRET: 'preview-secret-preview-secret-1234', PUBLIC_URL: 'http://localhost:18788', ADMIN_PUBLIC_URL: 'http://localhost:18788', APP_ENV: 'development', LOG_LEVEL: 'warn' }
const run = (args) => new Promise((res) => spawn(process.execPath, ['--import', 'tsx', ...args], { cwd: root, env, stdio: 'inherit' }).on('exit', res))

const boot = `
import { hashPassword, createUserId } from './src/auth.js'
import { db } from './src/db.js'
import { initPlatform } from './src/platform/index.js'
import { setRoles } from './src/platform/modules/iam/service.js'
initPlatform()
const id = createUserId()
db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?,?,?,?)').run(id, 'preview', await hashPassword('preview-password-1'), new Date().toISOString())
setRoles(id, ['OWNER'], null)
`
const { writeFileSync, rmSync } = await import('node:fs')
const seed = join(root, '.preview-seed.ts')
writeFileSync(seed, boot)
await run([seed])
rmSync(seed, { force: true })
await run(['src/index.ts'])
