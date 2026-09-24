// Copies the Swift Client mod jar into src-tauri/resources/ so the installer ships it
// (the launcher installs it into Swift instances). Runs before every build.
//
// Looked up, in order: $SWIFT_MOD_JAR, ./swiftclient-mod/build/libs (CI checkout),
// ../swiftclient-mod/build/libs (the mod repository next to this one).
// Fails the build if no jar is found and none is bundled yet: a launcher without the mod
// would create Swift instances that cannot start.
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const target = join(root, 'src-tauri', 'resources', 'swiftclient-mod.jar')

function newestJar(dir) {
  if (!existsSync(dir)) return null
  const jars = readdirSync(dir)
    .filter(f => /^swiftclient-mod-\d[\w.+-]*\.jar$/.test(f) && !f.includes('sources'))
    .map(f => join(dir, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
  return jars[0] ?? null
}

const source = process.env.SWIFT_MOD_JAR && existsSync(process.env.SWIFT_MOD_JAR)
  ? process.env.SWIFT_MOD_JAR
  : newestJar(join(root, 'swiftclient-mod', 'build', 'libs')) ?? newestJar(join(root, '..', 'swiftclient-mod', 'build', 'libs'))

mkdirSync(dirname(target), { recursive: true })
if (source) {
  copyFileSync(source, target)
  console.log(`[bundle-mod] ${source} -> src-tauri/resources/swiftclient-mod.jar`)
} else if (existsSync(target)) {
  console.log('[bundle-mod] no new mod build found, keeping the bundled jar')
} else {
  console.error('[bundle-mod] Swift Client mod jar not found. Build it (swiftclient-mod: ./gradlew jar) or set SWIFT_MOD_JAR.')
  process.exit(1)
}
