// Copies the Swift Client mod jar into src-tauri/resources/ so the installer ships it
// (the launcher installs it into Swift instances). Runs before every build.
//
// Looked up, in order: $SWIFT_MOD_JAR, then versions/26.2/build/libs (or build/libs for older builds) of
// ./swiftclient-mod (CI checkout) and ../swiftclient-mod (the mod repository next to this one).
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

// The Minecraft version Swift instances run (src-tauri/src/commands/client_mod.rs, SWIFT_MC_VERSION): the mod
// builds one jar per Minecraft version, in versions/<mc>/build/libs.
const SWIFT_MC_VERSION = '26.2'
const repoLibs = repo => [join(repo, 'versions', SWIFT_MC_VERSION, 'build', 'libs'), join(repo, 'build', 'libs')]

const source = process.env.SWIFT_MOD_JAR && existsSync(process.env.SWIFT_MOD_JAR)
  ? process.env.SWIFT_MOD_JAR
  : [...repoLibs(join(root, 'swiftclient-mod')), ...repoLibs(join(root, '..', 'swiftclient-mod'))].map(newestJar).find(Boolean) ?? null

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
