/** Quick Play (launch straight into a world or server) exists from 1.20. */
export function supportsQuickPlay(mcVersion: string): boolean {
  const [major = '0', minor = '0'] = mcVersion.split('.')
  return Number(major) > 1 || Number(minor) >= 20
}

/** "play.example.net:25566" → { host, port } */
export function parseServerAddress(address: string): { host: string, port?: number } {
  const [host = address, portText] = address.split(':')
  const port = portText ? Number(portText) : undefined
  return { host, port: Number.isFinite(port) ? port : undefined }
}
