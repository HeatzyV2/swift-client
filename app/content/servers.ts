export interface PartnerServer {
  id: string
  name: string
  address: string
}

/**
 * Servers partnered with Swift Client, shown in the Servers tab. Live status,
 * MOTD and player count come from the real `ping_server` Tauri command — never
 * hardcode those here. Add an entry as partnerships happen; keep only verified
 * name/address pairs.
 */
export const PARTNER_SERVERS: PartnerServer[] = [
  { id: 'elysia-smp', name: 'Elysia SMP', address: 'elysiasmp.com' },
]

/**
 * Server shown in the Home status panel when the selected instance has no
 * servers of its own. Set `address` to an empty string to hide the panel instead.
 */
export const FEATURED_SERVER = PARTNER_SERVERS[0]!
