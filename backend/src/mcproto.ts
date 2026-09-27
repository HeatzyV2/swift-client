// Just enough of the Minecraft Java protocol for the relay gateway: read the handshake (which carries
// the address the player typed, e.g. "notch.swiftclient.fr"), and answer a server-list ping or refuse a
// login when no world is hosted under that name.

export type Handshake = {
  protocol: number
  host: string
  port: number
  nextState: number
  /** Bytes the handshake packet took, from the start of the buffer. */
  length: number
}

/** VarInt at `offset`: [value, bytes read], null if the buffer ends first. Throws on a malformed one. */
export function readVarInt(buf: Buffer, offset: number): [number, number] | null {
  let value = 0
  for (let i = 0; i < 5; i++) {
    if (offset + i >= buf.length) return null
    const b = buf[offset + i]
    value |= (b & 0x7f) << (7 * i)
    if ((b & 0x80) === 0) return [value, i + 1]
  }
  throw new Error('VarInt too long')
}

export function writeVarInt(value: number): Buffer {
  const out: number[] = []
  let v = value >>> 0
  do {
    let b = v & 0x7f
    v >>>= 7
    if (v !== 0) b |= 0x80
    out.push(b)
  } while (v !== 0)
  return Buffer.from(out)
}

function mcString(s: string): Buffer {
  const bytes = Buffer.from(s, 'utf8')
  return Buffer.concat([writeVarInt(bytes.length), bytes])
}

/** A length-prefixed packet: id + payload. */
export function packet(id: number, ...parts: Buffer[]): Buffer {
  const body = Buffer.concat([writeVarInt(id), ...parts])
  return Buffer.concat([writeVarInt(body.length), body])
}

/**
 * First packet of a connection. Null while incomplete; throws if it is not a handshake
 * (legacy ping 0xFE, garbage, oversized).
 */
export function parseHandshake(buf: Buffer): Handshake | null {
  if (buf.length > 0 && buf[0] === 0xfe) throw new Error('legacy ping')
  const len = readVarInt(buf, 0)
  if (!len) return null
  const [size, lenBytes] = len
  if (size <= 0 || size > 1024) throw new Error('bad handshake size')
  if (buf.length < lenBytes + size) return null
  let o = lenBytes
  const end = lenBytes + size
  const id = readVarInt(buf, o)
  if (!id || id[0] !== 0x00) throw new Error('not a handshake')
  o += id[1]
  const proto = readVarInt(buf, o)
  if (!proto) throw new Error('truncated')
  o += proto[1]
  const hostLen = readVarInt(buf, o)
  if (!hostLen || hostLen[0] > 255 * 4) throw new Error('bad host')
  o += hostLen[1]
  const host = buf.subarray(o, o + hostLen[0]).toString('utf8')
  o += hostLen[0]
  if (o + 2 > end) throw new Error('truncated')
  const port = buf.readUInt16BE(o)
  o += 2
  const next = readVarInt(buf, o)
  if (!next) throw new Error('truncated')
  return { protocol: proto[0], host, port, nextState: next[0], length: end }
}

/**
 * Hosted-world name in an address: "Notch.swiftclient.fr." -> "notch". Forge/proxies append data after
 * a NUL byte; underscores (valid in Minecraft names) may have been typed as dashes. Null when the address
 * is not a subdomain of `domain`.
 */
export function worldName(host: string, domain: string): string | null {
  const clean = host.split('\0')[0].trim().toLowerCase().replace(/\.$/, '')
  const suffix = `.${domain.toLowerCase()}`
  if (!clean.endsWith(suffix)) return null
  const label = clean.slice(0, -suffix.length)
  return /^[a-z0-9_-]{1,32}$/.test(label) ? normName(label) : null
}

/** Key used to match an address to a Minecraft name: case and _/- do not matter. */
export function normName(name: string): string {
  return name.toLowerCase().replace(/_/g, '-')
}

export function statusResponse(protocol: number, motd: string): Buffer {
  const json = JSON.stringify({
    version: { name: 'Swift Client', protocol },
    players: { max: 0, online: 0 },
    description: { text: motd },
  })
  return packet(0x00, mcString(json))
}

export function loginDisconnect(message: string): Buffer {
  return packet(0x00, mcString(JSON.stringify({ text: message })))
}

/**
 * Serves the status exchange after the handshake: status request -> response, ping -> pong.
 * `pending` holds bytes already received after the handshake.
 */
export function answerStatus(sock: import('node:net').Socket, protocol: number, motd: string, pending: Buffer) {
  let buf = pending
  const onData = (chunk?: Buffer) => {
    if (chunk) buf = Buffer.concat([buf, chunk])
    for (;;) {
      let len: [number, number] | null
      try {
        len = readVarInt(buf, 0)
      } catch {
        return sock.destroy()
      }
      if (!len || buf.length < len[1] + len[0]) return
      const body = buf.subarray(len[1], len[1] + len[0])
      buf = buf.subarray(len[1] + len[0])
      const id = body[0]
      if (id === 0x00) {
        sock.write(statusResponse(protocol, motd))
      } else if (id === 0x01) {
        sock.end(packet(0x01, body.subarray(1)))
        return
      } else {
        return sock.destroy()
      }
    }
  }
  sock.on('data', onData)
  sock.resume()
  onData()
}
