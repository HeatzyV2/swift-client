// Regenerates the route reference of docs/API.md from the live route registry (single source of truth).
//   npm run docs:api
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'swift-docs-'))
process.env.JWT_SECRET = 'docs-secret-docs-secret-docs-secret'
process.env.LOG_LEVEL = 'silent'

const { createApp } = await import('../src/app.js')
const { registry } = await import('../src/platform/core/http.js')
createApp()

const file = resolve(fileURLToPath(new URL('../docs/API.md', import.meta.url)))
const START = '<!-- routes:start -->'
const END = '<!-- routes:end -->'

const byTag = new Map<string, typeof registry>()
for (const r of registry) byTag.set(r.tag, [...(byTag.get(r.tag) ?? []), r])

const lines: string[] = [START, '']
for (const [tag, routes] of byTag) {
  lines.push(`### ${tag}`, '', '| Method | Path | Access | Description |', '|---|---|---|---|')
  for (const r of routes) {
    const access = r.auth === 'public' ? 'public' : r.auth === 'user' ? 'signed-in' : `\`${r.auth}\``
    lines.push(`| ${r.method.toUpperCase()} | \`${r.path}\` | ${access} | ${r.summary} |`)
  }
  lines.push('')
}
lines.push(END)

const doc = readFileSync(file, 'utf8')
const next = doc.includes(START) ? doc.replace(new RegExp(`${START}[\\s\\S]*${END}`), lines.join('\n')) : `${doc}\n${lines.join('\n')}\n`
writeFileSync(file, next)
console.log(`docs/API.md: ${registry.length} routes in ${byTag.size} groups`)
process.exit(0)
