// Small in-process cache with TTL and tag invalidation. The platform is a single node, so this is enough:
// every admin write calls invalidate(tag), and public reads fall back to the database on a miss.
type Entry = { value: unknown, expires: number, tags: string[] }

const store = new Map<string, Entry>()

function sweep() {
  const now = Date.now()
  for (const [k, e] of store) if (e.expires <= now) store.delete(k)
}

export const cache = {
  get<T>(key: string, ttlMs: number, tags: string[], load: () => T): T {
    const hit = store.get(key)
    const now = Date.now()
    if (hit && hit.expires > now) return hit.value as T
    const value = load()
    if (ttlMs > 0) store.set(key, { value, expires: now + ttlMs, tags })
    if (store.size > 2000) sweep()
    return value
  },
  invalidate(...tags: string[]) {
    for (const [k, e] of store) if (e.tags.some(t => tags.includes(t))) store.delete(k)
  },
  clear() {
    store.clear()
  },
}
