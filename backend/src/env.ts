import { config as loadEnv } from 'dotenv'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

// Pterodactyl / local .env in the working directory
loadEnv()

function firstNum(...names: string[]): number | undefined {
  for (const name of names) {
    const raw = process.env[name]
    if (!raw || !raw.trim()) continue
    const n = Number(raw)
    if (Number.isFinite(n) && n > 0) return n
  }
  return undefined
}

function str(name: string, fallback = ''): string {
  return (process.env[name] ?? fallback).trim()
}

// Pterodactyl injects SERVER_PORT; fall back to PORT then 8787
const port = firstNum('SERVER_PORT', 'PORT') ?? 8787
const host = str('HOST', '0.0.0.0')

const dataDir = resolve(str('DATA_DIR', './data'))
mkdirSync(dataDir, { recursive: true })
mkdirSync(resolve(dataDir, 'shares'), { recursive: true })
mkdirSync(resolve(dataDir, 'media'), { recursive: true })
mkdirSync(resolve(dataDir, 'uploads'), { recursive: true })

export const env = {
  port,
  host,
  publicUrl: str('PUBLIC_URL', 'http://151.240.30.3:10049').replace(/\/$/, ''),
  sharePublicUrl: str('SHARE_PUBLIC_URL', 'swift://share').replace(/\/$/, ''),
  dataDir,
  jwtSecret: str('JWT_SECRET', 'dev-insecure-secret-change-me'),
  curseforgeApiKey: str('CURSEFORGE_API_KEY'),
  mediaTtlDays: firstNum('MEDIA_TTL_DAYS') ?? 7,
  shareTtlDays: firstNum('SHARE_TTL_DAYS') ?? 30,
  cleanupIntervalMs: firstNum('CLEANUP_INTERVAL_MS') ?? 3_600_000,
  version: '0.1.0',
}

export function shareRedeemUrl(code: string): string {
  const base = env.sharePublicUrl
  if (base.includes('://') && !base.endsWith('/share') && base.startsWith('swift://')) {
    return `${base}/${code}`
  }
  return `${base}/${code}`
}
