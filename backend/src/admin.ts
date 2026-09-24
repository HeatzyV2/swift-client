// Admin commands, run on the server (Pterodactyl console: `node dist/admin.js <command>`).
//
//   cosmetic add <id> <cape|pet> <price> <texture.png> [name...] [--frames N --fps N --size WxH]
//                [--model geo.json --animation anim.json --loop anim.name --player-skin]
//   cosmetic rm <id>
//   cosmetic list
//   give <player> <cosmeticId>          coins <player> <+N|-N>
//   grade <player> <grade|none>         plus <player> <days|0>
//   user <player>
//
// <player> is a Swift username or a Minecraft name/UUID.
import { copyFileSync, existsSync } from 'node:fs'
import { basename, extname, resolve } from 'node:path'
import { findUserByUsername } from './auth.js'
import { db, type UserRow } from './db.js'
import { env } from './env.js'
import { findUserByMinecraft, findUserByMinecraftName } from './minecraft.js'

function die(message: string): never {
  console.error(message)
  process.exit(1)
}

function player(ref: string | undefined): UserRow {
  if (!ref) die('player required')
  const row = /^[0-9a-fA-F-]{32,36}$/.test(ref)
    ? findUserByMinecraft(ref)
    : findUserByUsername(ref) ?? findUserByMinecraftName(ref)
  return row ?? die(`no Swift account for "${ref}" (the player must have launched Swift Client once)`)
}

function flags(args: string[]): { rest: string[], opts: Record<string, string | true> } {
  const rest: string[] = []
  const opts: Record<string, string | true> = {}
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a.startsWith('--')) {
      const next = args[i + 1]
      if (next !== undefined && !next.startsWith('--')) {
        opts[a.slice(2)] = next
        i++
      } else {
        opts[a.slice(2)] = true
      }
    } else {
      rest.push(a)
    }
  }
  return { rest, opts }
}

/** Copies an asset into data/cosmetics and returns the stored path. */
function store(id: string, file: string | true | undefined, suffix: string): string | null {
  if (typeof file !== 'string') return null
  if (!existsSync(file)) die(`file not found: ${file}`)
  const dest = resolve(env.dataDir, 'cosmetics', `${id}${suffix}${extname(file) || ''}`)
  copyFileSync(file, dest)
  return dest
}

function show(row: UserRow) {
  const owned = (db.prepare('SELECT cosmetic_id FROM user_cosmetics WHERE user_id = ?').all(row.id) as { cosmetic_id: string }[])
    .map(r => r.cosmetic_id)
  console.log({
    username: row.username,
    minecraft: `${row.mc_username ?? '-'} ${row.mc_uuid ?? ''} ${row.mc_verified ? '(verified)' : '(unverified)'}`,
    coins: row.coins ?? 0,
    grade: row.grade ?? null,
    swiftPlusUntil: row.swift_plus_until ?? null,
    cape: row.equipped_cape ?? null,
    pet: row.equipped_pet ?? null,
    owned,
    lastSeen: row.last_seen ?? null,
  })
}

const [cmd, ...args] = process.argv.slice(2)

switch (cmd) {
  case 'cosmetic': {
    const [sub, ...rest0] = args
    const { rest, opts } = flags(rest0)
    if (sub === 'list') {
      console.table(db.prepare('SELECT id, type, name, price, frames, fps FROM cosmetics ORDER BY type, id').all())
    } else if (sub === 'rm') {
      const id = rest[0] ?? die('id required')
      db.prepare('DELETE FROM user_cosmetics WHERE cosmetic_id = ?').run(id)
      db.prepare('UPDATE users SET equipped_cape = NULL WHERE equipped_cape = ?').run(id)
      db.prepare('UPDATE users SET equipped_pet = NULL WHERE equipped_pet = ?').run(id)
      console.log(db.prepare('DELETE FROM cosmetics WHERE id = ?').run(id).changes ? `removed ${id}` : `no cosmetic ${id}`)
    } else if (sub === 'add') {
      const [id, type, price, texture, ...nameParts] = rest
      if (!id || !/^[a-z0-9_-]{2,48}$/.test(id)) die('id: 2-48 chars, a-z 0-9 _ -')
      if (type !== 'cape' && type !== 'pet') die('type: cape or pet')
      if (!price || !/^\d+$/.test(price)) die('price: coins (0 = free)')
      if (!texture) die('texture PNG required')
      if (type === 'pet' && typeof opts.model !== 'string') die('a pet needs --model geo.json')
      const [w, h] = typeof opts.size === 'string' ? opts.size.split('x').map(Number) : [64, 32]
      const texturePath = store(id, texture, '')
      db.prepare(`
        INSERT INTO cosmetics (id, type, name, price, frames, fps, frame_w, frame_h, texture_path, model_path,
                               animation_path, loop_anim, player_skin, created_at)
        VALUES (@id, @type, @name, @price, @frames, @fps, @w, @h, @texture, @model, @animation, @loop, @skin, @now)
        ON CONFLICT(id) DO UPDATE SET type = @type, name = @name, price = @price, frames = @frames, fps = @fps,
          frame_w = @w, frame_h = @h, texture_path = @texture, model_path = COALESCE(@model, model_path),
          animation_path = COALESCE(@animation, animation_path), loop_anim = @loop, player_skin = @skin
      `).run({
        id,
        type,
        name: nameParts.join(' ') || basename(texture, extname(texture)),
        price: Number(price),
        frames: Number(opts.frames ?? 1) || 1,
        fps: Number(opts.fps ?? 10) || 10,
        w: w || 64,
        h: h || 32,
        texture: texturePath,
        model: store(id, opts.model, '.geo'),
        animation: store(id, opts.animation, '.animation'),
        loop: typeof opts.loop === 'string' ? opts.loop : 'idle',
        skin: opts['player-skin'] ? 1 : 0,
        now: new Date().toISOString(),
      })
      console.log(`saved ${type} ${id}`)
    } else {
      die('cosmetic add | rm | list')
    }
    break
  }
  case 'give': {
    const row = player(args[0])
    const id = args[1] ?? die('cosmetic id required')
    if (!db.prepare('SELECT 1 FROM cosmetics WHERE id = ?').get(id)) die(`no cosmetic ${id}`)
    db.prepare('INSERT OR IGNORE INTO user_cosmetics (user_id, cosmetic_id, created_at) VALUES (?, ?, ?)').run(row.id, id, new Date().toISOString())
    console.log(`${row.username} now owns ${id}`)
    break
  }
  case 'coins': {
    const row = player(args[0])
    const delta = Number(args[1])
    if (!Number.isInteger(delta)) die('amount: +N or -N')
    db.prepare('UPDATE users SET coins = MAX(0, coins + ?) WHERE id = ?').run(delta, row.id)
    console.log(`${row.username}: ${(db.prepare('SELECT coins FROM users WHERE id = ?').get(row.id) as { coins: number }).coins} coins`)
    break
  }
  case 'grade': {
    const row = player(args[0])
    const grade = args[1] ?? die('grade required (none to clear)')
    db.prepare('UPDATE users SET grade = ? WHERE id = ?').run(grade === 'none' ? null : grade, row.id)
    console.log(`${row.username}: grade ${grade}`)
    break
  }
  case 'plus': {
    const row = player(args[0])
    const days = Number(args[1])
    if (!Number.isFinite(days) || days < 0) die('days: 0 or more')
    const until = days === 0 ? null : new Date(Date.now() + days * 86_400_000).toISOString()
    db.prepare('UPDATE users SET swift_plus_until = ? WHERE id = ?').run(until, row.id)
    console.log(`${row.username}: Swift+ ${until ? `until ${until}` : 'removed'}`)
    break
  }
  case 'user':
    show(player(args[0]))
    break
  default:
    console.log('commands: cosmetic add|rm|list, give, coins, grade, plus, user (see the top of src/admin.ts)')
}
