// World hosting relay ("Host World" in the mod). A player hosting a world keeps a control connection
// here; the relay opens a public port for them and forwards every player who connects to it:
//
//   host  -> REGISTER <sessionId> <token>\n      (token: the game token from /api/auth/minecraft)
//   relay -> PORT <n>\n                           (public port players join on)
//   relay -> NEW <connId>\n                       (someone connected to the public port)
//   host  -> (new socket) DATA <sessionId> <connId>\n, then raw bytes piped to that player
//   relay -> ERROR <message>\n                    (then closes)
import net from 'node:net'
import { verifyToken } from './auth.js'
import { env } from './env.js'

type Session = {
  id: string
  userId: string
  control: net.Socket
  server: net.Server
  port: number
  nextConn: number
  pending: Map<number, { socket: net.Socket, timer: NodeJS.Timeout }>
  open: Set<net.Socket>
}

const HEADER_MAX = 512
const HEADER_TIMEOUT_MS = 10_000
/** A joining player waits this long for the host to open its data connection. */
const PENDING_TIMEOUT_MS = 15_000
const MAX_PENDING = 16

const sessions = new Map<string, Session>()
const byUser = new Map<string, Session>()
const usedPorts = new Set<number>()

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
  usedPorts.delete(s.port)
  s.server.close()
  for (const p of s.pending.values()) {
    clearTimeout(p.timer)
    p.socket.destroy()
  }
  for (const sock of s.open) sock.destroy()
  s.control.destroy()
  console.log(`[relay] session ${s.id} closed (port ${s.port})`)
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

  let session: Session | undefined
  const opened = await listenFree((player) => {
    if (!session) return player.destroy()
    if (session.pending.size >= MAX_PENDING) return player.destroy()
    player.pause()
    player.setNoDelay(true)
    const connId = session.nextConn++
    const timer = setTimeout(() => {
      session!.pending.delete(connId)
      player.destroy()
    }, PENDING_TIMEOUT_MS)
    session.pending.set(connId, { socket: player, timer })
    player.on('error', () => player.destroy())
    player.on('close', () => {
      const p = session!.pending.get(connId)
      if (p?.socket === player) {
        clearTimeout(p.timer)
        session!.pending.delete(connId)
      }
    })
    send(session.control, `NEW ${connId}`)
  })
  if (!opened) return fail(control, 'no relay port free, try again later')
  if (control.destroyed) {
    usedPorts.delete(opened.port)
    opened.server.close()
    return
  }

  session = {
    id: sessionId,
    userId: user.id,
    control,
    server: opened.server,
    port: opened.port,
    nextConn: 1,
    pending: new Map(),
    open: new Set(),
  }
  sessions.set(sessionId, session)
  byUser.set(user.id, session)
  control.setKeepAlive(true, 30_000)
  control.on('close', () => closeSession(session!))
  control.on('error', () => closeSession(session!))
  control.resume()
  control.on('data', () => { /* the host sends nothing more on the control socket */ })
  send(control, `PORT ${opened.port}`)
  console.log(`[relay] ${user.username} hosts session ${sessionId} on port ${opened.port}`)
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
  if (rest.length) player.write(rest)
  host.pipe(player)
  player.pipe(host)
  host.resume()
  player.resume()
}

export function startRelay() {
  if (!env.relayPort) {
    console.log('[relay] disabled (RELAY_PORT not set)')
    return
  }
  if (!env.relayPortMin || env.relayPortMax < env.relayPortMin) {
    console.warn('[relay] RELAY_PORT_MIN / RELAY_PORT_MAX not set: no public port to give hosts, relay disabled')
    return
  }
  const server = net.createServer((sock) => {
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
  })
  server.on('error', (e) => console.error('[relay] control port error', e))
  server.listen(env.relayPort, env.host, () => {
    console.log(`[relay] control on ${env.host}:${env.relayPort}, public ports ${env.relayPortMin}-${env.relayPortMax}`)
  })
}

/** For /api/relay: where the game should connect, null when the relay is off. */
export function relayInfo(): { port: number } | null {
  return env.relayPort && env.relayPortMin && env.relayPortMax >= env.relayPortMin ? { port: env.relayPort } : null
}
