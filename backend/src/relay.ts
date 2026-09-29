// World hosting relay ("Host World" in the mod). A player hosting a world keeps a control connection
// here; players reach the world through the gateway (address "<minecraft name>.swiftclient.fr", routed by
// the hostname in the Minecraft handshake) and, when a port range is configured, through a public port:
//
//   host  -> REGISTER <sessionId> <token>\n      (token: the game token from /api/auth/minecraft)
//   relay -> HOST <name>.<domain>\n               (gateway address, when the gateway is on)
//   relay -> PORT <n>\n                           (public port, 0 when there is no port range)
//   relay -> NEW <connId>\n                       (a player connected)
//   host  -> (new socket) DATA <sessionId> <connId>\n, then raw bytes piped to that player
//   relay -> ERROR <message>\n                    (then closes)
import net from 'node:net'
import { verifyToken } from './auth.js'
import { db } from './db.js'
import { env } from './env.js'
import { answerStatus, loginDisconnect, normName, parseHandshake, worldName } from './mcproto.js'
import { sniffTls } from './tls.js'

type Pending = { socket: net.Socket, timer: NodeJS.Timeout, prefix: Buffer }

type Session = {
  id: string
  userId: string
  /** Normalized Minecraft name the gateway routes on, null without a verified Minecraft account. */
  name: string | null
  control: net.Socket
  server: net.Server | null
  port: number
  nextConn: number
  pending: Map<number, Pending>
  open: Set<net.Socket>
}

const HEADER_MAX = 512
const HEADER_TIMEOUT_MS = 10_000
/** A joining player waits this long for the host to open its data connection. */
const PENDING_TIMEOUT_MS = 15_000
const MAX_PENDING = 16
const HANDSHAKE_MAX = 2048

const sessions = new Map<string, Session>()
const byUser = new Map<string, Session>()
const byName = new Map<string, Session>()
const usedPorts = new Set<number>()

function gatewayOn(): boolean {
  return env.relayGatewayPort > 0 && !!env.relayDomain
}

function rangeOn(): boolean {
  return env.relayPortMin > 0 && env.relayPortMax >= env.relayPortMin
}

function send(sock: net.Socket, line: string) {
  if (!sock.destroyed) sock.write(`${line}\n`)
}

function fail(sock: net.Socket, message: string) {
  if (!sock.destroyed) sock.end(`ERROR ${message}\n`)
}

/** Reads the first line of a connection, then hands over the socket and whatever followed it. */
function readHeader(sock: net.Socket, onLine: (line: string, rest: Buffer) => void) {
  let buf = Buffer.alloc(0)
  const timer = setTimeout(() => sock.destroy(), HEADER_TIMEOUT_MS)
  const onData = (chunk: Buffer) => {
    buf = Buffer.concat([buf, chunk])
    const nl = buf.indexOf(0x0a)
    if (nl < 0) {
      if (buf.length > HEADER_MAX) sock.destroy()
      return
    }
    clearTimeout(timer)
    sock.off('data', onData)
    sock.pause()
    onLine(buf.subarray(0, nl).toString('utf8').replace(/\r$/, '').trim(), buf.subarray(nl + 1))
  }
  sock.on('data', onData)
  sock.on('error', () => clearTimeout(timer))
  sock.on('close', () => clearTimeout(timer))
}

function closeSession(s: Session) {
  if (sessions.get(s.id) !== s) return
  sessions.delete(s.id)
  if (byUser.get(s.userId) === s) byUser.delete(s.userId)
  if (s.name && byName.get(s.name) === s) byName.delete(s.name)
  if (s.port) usedPorts.delete(s.port)
  s.server?.close()
  for (const p of s.pending.values()) {
    clearTimeout(p.timer)
    p.socket.destroy()
  }
  for (const sock of s.open) sock.destroy()
  s.control.destroy()
  console.log(`[relay] session ${s.id} closed`)
}

/** A player reached the world (public port or gateway): ask the host to open a data connection. */
function acceptPlayer(session: Session, player: net.Socket, prefix: Buffer) {
  if (session.pending.size >= MAX_PENDING) return player.destroy()
  player.pause()
  player.setNoDelay(true)
  const connId = session.nextConn++
  const timer = setTimeout(() => {
    session.pending.delete(connId)
    player.destroy()
  }, PENDING_TIMEOUT_MS)
  session.pending.set(connId, { socket: player, timer, prefix })
  player.on('error', () => player.destroy())
  player.on('close', () => {
    const p = session.pending.get(connId)
    if (p?.socket === player) {
      clearTimeout(p.timer)
      session.pending.delete(connId)
    }
  })
  send(session.control, `NEW ${connId}`)
}

function listenFree(onConn: (sock: net.Socket) => void): Promise<{ server: net.Server, port: number } | null> {
  const ports: number[] = []
  for (let p = env.relayPortMin; p > 0 && p <= env.relayPortMax; p++) {
    if (!usedPorts.has(p)) ports.push(p)
  }
  return new Promise((resolve) => {
    const next = () => {
      const port = ports.shift()
      if (port === undefined) return resolve(null)
      const server = net.createServer(onConn)
      server.once('error', () => next())
      server.listen(port, env.host, () => {
        usedPorts.add(port)
        resolve({ server, port })
      })
    }
    next()
  })
}

async function register(control: net.Socket, sessionId: string, token: string) {
  if (!/^[A-Za-z0-9]{8,64}$/.test(sessionId)) return fail(control, 'bad session id')
  const user = token ? await verifyToken(token) : null
  if (!user) return fail(control, 'sign in to Swift Client to host a world')
  if (sessions.has(sessionId)) return fail(control, 'session already registered')

  // One hosted world per account: a new one replaces the previous.
  const previous = byUser.get(user.id)
  if (previous) closeSession(previous)

  // The gateway name is the Minecraft name Mojang confirmed for this account.
  const row = db.prepare('SELECT mc_username, mc_verified FROM users WHERE id = ?').get(user.id) as
    { mc_username: string | null, mc_verified: number } | undefined
  const mcName = row?.mc_verified === 1 && row.mc_username ? row.mc_username : null
  const name = gatewayOn() && mcName ? normName(mcName) : null
  if (!name && !rangeOn()) return fail(control, 'hosting needs a Minecraft account confirmed by Mojang')

  let session: Session | undefined
  let opened: { server: net.Server, port: number } | null = null
  if (rangeOn()) {
    opened = await listenFree((player) => (session ? acceptPlayer(session, player, Buffer.alloc(0)) : player.destroy()))
    if (!opened && !name) return fail(control, 'no relay port free, try again later')
  }
  if (control.destroyed) {
    if (opened) {
      usedPorts.delete(opened.port)
      opened.server.close()
    }
    return
  }

  session = {
    id: sessionId,
    userId: user.id,
    name,
    control,
    server: opened?.server ?? null,
    port: opened?.port ?? 0,
    nextConn: 1,
    pending: new Map(),
    open: new Set(),
  }
  sessions.set(sessionId, session)
  byUser.set(user.id, session)
  if (name) {
    const other = byName.get(name)
    if (other && other !== session) closeSession(other)
    byName.set(name, session)
  }
  control.setKeepAlive(true, 30_000)
  control.on('close', () => closeSession(session!))
  control.on('error', () => closeSession(session!))
  control.resume()
  control.on('data', () => { /* the host sends nothing more on the control socket */ })
  // Off 25565 the port is written in the address: an SRV record would not work, because Minecraft then puts
  // the SRV target (not "<name>.<domain>") in its handshake and the gateway could not tell the worlds apart.
  const gatewaySuffix = env.relayGatewayPort === 25565 ? '' : `:${env.relayGatewayPort}`
  if (name && mcName) send(control, `HOST ${mcName.toLowerCase().replace(/_/g, '-')}.${env.relayDomain}${gatewaySuffix}`)
  send(control, `PORT ${session.port}`)
  console.log(`[relay] ${user.username} hosts session ${sessionId}${name ? ` as ${name}.${env.relayDomain}` : ''}${session.port ? ` on port ${session.port}` : ''}`)
}

function attachData(host: net.Socket, sessionId: string, connId: number, rest: Buffer) {
  const s = sessions.get(sessionId)
  const pending = s?.pending.get(connId)
  if (!s || !pending) return host.destroy()
  clearTimeout(pending.timer)
  s.pending.delete(connId)
  const player = pending.socket
  host.setNoDelay(true)
  s.open.add(host)
  s.open.add(player)
  const cleanup = () => {
    s.open.delete(host)
    s.open.delete(player)
    host.destroy()
    player.destroy()
  }
  host.on('error', cleanup)
  player.on('error', cleanup)
  host.on('close', cleanup)
  player.on('close', cleanup)
  // What the gateway already read from the player (the handshake) goes first.
  if (pending.prefix.length) host.write(pending.prefix)
  if (rest.length) player.write(rest)
  host.pipe(player)
  player.pipe(host)
  host.resume()
  player.resume()
}

/** Gateway: routes a Minecraft connection by the address in its handshake. */
function gatewayConnection(sock: net.Socket) {
  sock.setNoDelay(true)
  sock.on('error', () => sock.destroy())
  let buf = Buffer.alloc(0)
  const timer = setTimeout(() => sock.destroy(), HEADER_TIMEOUT_MS)
  const onData = (chunk: Buffer) => {
    buf = Buffer.concat([buf, chunk])
    let hs
    try {
      hs = parseHandshake(buf)
    } catch {
      clearTimeout(timer)
      return sock.destroy()
    }
    if (!hs) {
      if (buf.length > HANDSHAKE_MAX) sock.destroy()
      return
    }
    clearTimeout(timer)
    sock.off('data', onData)
    sock.pause()
    const name = worldName(hs.host, env.relayDomain)
    const session = name ? byName.get(name) : undefined
    if (session) return acceptPlayer(session, sock, buf)

    const label = name ?? hs.host.split('\0')[0]
    if (hs.nextState === 1) {
      answerStatus(sock, hs.protocol, `§cAucun monde hébergé par §f${label}\n§7Swift Client · swiftclient.fr`, buf.subarray(hs.length))
    } else {
      sock.end(loginDisconnect(`Aucun monde n'est hébergé par ${label} pour le moment.`))
    }
  }
  sock.on('data', onData)
  sock.on('close', () => clearTimeout(timer))
}

export function startRelay() {
  if (!env.relayPort) {
    console.log('[relay] disabled (RELAY_PORT not set)')
    return
  }
  if (!rangeOn() && !gatewayOn()) {
    console.warn('[relay] neither RELAY_GATEWAY_PORT nor RELAY_PORT_MIN/MAX set: players could not join, relay disabled')
    return
  }
  // The control port speaks TLS when a certificate is configured (the token travels there), plain for older clients.
  const control = (sock: net.Socket) => {
    sock.on('error', () => sock.destroy())
    readHeader(sock, (line, rest) => {
      const parts = line.split(' ')
      if (parts[0] === 'REGISTER' && parts.length >= 2) {
        register(sock, parts[1], parts[2] ?? '').catch((e) => {
          console.error('[relay] register failed', e)
          fail(sock, 'relay error')
        })
      } else if (parts[0] === 'DATA' && parts.length === 3 && /^\d+$/.test(parts[2])) {
        attachData(sock, parts[1], Number(parts[2]), rest)
      } else {
        fail(sock, 'unknown command')
      }
    })
  }
  const server = net.createServer(sniffTls(control, control))
  server.on('error', (e) => console.error('[relay] control port error', e))
  server.listen(env.relayPort, env.host, () => {
    console.log(`[relay] control on ${env.host}:${env.relayPort}${rangeOn() ? `, public ports ${env.relayPortMin}-${env.relayPortMax}` : ''}`)
  })

  if (gatewayOn()) {
    const gateway = net.createServer(gatewayConnection)
    gateway.on('error', (e) => console.error('[relay] gateway port error', e))
    gateway.listen(env.relayGatewayPort, env.host, () => {
      console.log(`[relay] gateway on ${env.host}:${env.relayGatewayPort} for *.${env.relayDomain}`)
    })
  }
}

/** For /api/relay: where the game should connect, null when the relay is off. */
export function relayInfo(): { port: number, domain: string | null } | null {
  return env.relayPort && (rangeOn() || gatewayOn()) ? { port: env.relayPort, domain: gatewayOn() ? env.relayDomain : null } : null
}
