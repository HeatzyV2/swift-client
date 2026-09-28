// HTTPS and plain HTTP (older clients) on the same port: the first byte of a TLS connection is 0x16
// (handshake record), which no HTTP request starts with. Certificate files: TLS_CERT / TLS_KEY, or
// DATA_DIR/tls/api.crt + api.key. Without them everything stays plain, as before.
import { existsSync, readFileSync } from 'node:fs'
import net from 'node:net'
import tls from 'node:tls'
import { Duplex } from 'node:stream'
import { env } from './env.js'

export type TlsFiles = { cert: Buffer, key: Buffer }

let cached: TlsFiles | null | undefined

export function tlsFiles(): TlsFiles | null {
  if (cached !== undefined) return cached
  cached = null
  if (env.tlsCert && env.tlsKey && existsSync(env.tlsCert) && existsSync(env.tlsKey)) {
    cached = { cert: readFileSync(env.tlsCert), key: readFileSync(env.tlsKey) }
  } else if (env.tlsCert || env.tlsKey) {
    console.warn(`[tls] certificate files not found (${env.tlsCert}, ${env.tlsKey}): serving plain HTTP only`)
  }
  return cached
}

/**
 * The raw socket as a JS stream starting with `first` (bytes already read). TLS must run over a JS
 * stream here: over the raw socket Node reads the OS handle directly and would miss `first`.
 */
function replay(sock: net.Socket, first: Buffer): Duplex {
  const d = new Duplex({
    read() {
      sock.resume()
    },
    write(chunk, _enc, cb) {
      sock.write(chunk, cb)
    },
    final(cb) {
      sock.end()
      cb()
    },
    destroy(err, cb) {
      sock.destroy()
      cb(err)
    },
  })
  d.push(first)
  sock.on('data', (c: Buffer) => {
    if (!d.push(c)) sock.pause()
  })
  sock.on('end', () => d.push(null))
  sock.on('close', () => d.destroy())
  sock.on('error', (e) => d.destroy(e))
  return d
}

/**
 * Calls `onPlain` or `onTls` with each connection depending on its first byte. `onTls` receives the
 * decrypted socket; `onPlain` the socket with the first bytes put back.
 */
export function sniffTls(onPlain: (sock: net.Socket) => void, onTls: (sock: net.Socket) => void): (sock: net.Socket) => void {
  const files = tlsFiles()
  if (!files) return onPlain
  const ctx = tls.createSecureContext({ cert: files.cert, key: files.key, minVersion: 'TLSv1.2' })
  return (sock) => {
    sock.once('error', () => sock.destroy())
    const timer = setTimeout(() => sock.destroy(), 15_000)
    sock.once('data', (chunk: Buffer) => {
      clearTimeout(timer)
      if (chunk[0] !== 0x16) {
        sock.pause()
        sock.unshift(chunk)
        onPlain(sock)
        sock.resume()
        return
      }
      const secure = new tls.TLSSocket(replay(sock, chunk) as unknown as net.Socket, { isServer: true, secureContext: ctx })
      secure.on('error', () => secure.destroy())
      secure.once('secure', () => onTls(secure))
    })
  }
}
