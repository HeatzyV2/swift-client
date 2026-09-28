// Checks that every interface language has every string of i18n/locales/en.json, with the
// same {placeholders}, and no leftover key English no longer has. Runs in CI.
// Run: node scripts/check-i18n.mjs
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'i18n', 'locales')

function flatten(node, prefix = '', out = new Map()) {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object') flatten(value, path, out)
    else out.set(path, String(value))
  }
  return out
}

const load = file => flatten(JSON.parse(readFileSync(join(dir, file), 'utf8').replace(/^﻿/, '')))
const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',')

const reference = load('en.json')
const problems = []

for (const file of readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'en.json').sort()) {
  const locale = load(file)
  const lang = file.replace('.json', '')
  for (const [key, text] of reference) {
    if (!locale.has(key)) problems.push(`${lang}: missing "${key}"`)
    else if (placeholders(locale.get(key)) !== placeholders(text)) {
      problems.push(`${lang}: "${key}" has {${placeholders(locale.get(key))}}, English has {${placeholders(text)}}`)
    }
  }
  for (const key of locale.keys()) {
    if (!reference.has(key)) problems.push(`${lang}: "${key}" no longer exists in en.json`)
  }
}

// Keys the interface asks for by name (t('a.b'), $t("a.b")) must exist. Keys built at
// run time (t(`play.step.${x}`)) cannot be checked here.
const app = join(dir, '..', '..', 'app')
function sources(folder) {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name)
    if (entry.isDirectory()) return sources(path)
    return /\.(vue|ts)$/.test(entry.name) ? [path] : []
  })
}
for (const file of sources(app)) {
  const code = readFileSync(file, 'utf8')
  for (const [, key] of code.matchAll(/\$?\bt\(\s*['"]([\w-]+(?:\.[\w-]+)+)['"]/g)) {
    if (!reference.has(key)) problems.push(`en: "${key}" is used in ${file.slice(app.length + 1).replaceAll('\\', '/')} but does not exist`)
  }
}

if (problems.length) {
  console.error(`i18n: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log(`i18n: ${reference.size} strings, every language complete`)
