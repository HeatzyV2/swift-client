// API client: bearer access token in memory, refresh token in localStorage, single-flight refresh on 401.
const BASE = (window.SWIFT_API || '').replace(/\/$/, '') + '/api/v1'
const RT_KEY = 'swift.admin.refresh'

let access = null
let refreshing = null
let onLogout = () => {}

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export function setLogoutHandler(fn) { onLogout = fn }
export const hasSession = () => !!localStorage.getItem(RT_KEY)

function store(tokens) {
  access = tokens.accessToken
  localStorage.setItem(RT_KEY, tokens.refreshToken)
}

export function clearSession() {
  access = null
  localStorage.removeItem(RT_KEY)
}

async function raw(method, path, body, isForm) {
  const headers = {}
  if (access) headers.Authorization = `Bearer ${access}`
  let payload
  if (body !== undefined) {
    if (isForm) payload = body
    else { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body) }
  }
  const res = await fetch(BASE + path, { method, headers, body: payload })
  let json = null
  try { json = await res.json() } catch { /* empty body */ }
  return { res, json }
}

async function refresh() {
  const token = localStorage.getItem(RT_KEY)
  if (!token) throw new ApiError(401, 'UNAUTHORIZED', 'Signed out')
  refreshing ??= (async () => {
    const { res, json } = await raw('POST', '/auth/refresh', { refreshToken: token })
    if (!res.ok || !json?.success) { clearSession(); throw new ApiError(401, 'UNAUTHORIZED', 'Session expired') }
    store(json.data)
    return json.data
  })().finally(() => { refreshing = null })
  return refreshing
}

/** Returns data; use apiFull() when pagination meta is needed. */
export async function api(method, path, body, isForm = false) {
  return (await apiFull(method, path, body, isForm)).data
}

export async function apiFull(method, path, body, isForm = false) {
  if (!access && hasSession()) await refresh().catch(() => {})
  let { res, json } = await raw(method, path, body, isForm)
  if (res.status === 401 && hasSession() && !path.startsWith('/auth/')) {
    try { await refresh() } catch { onLogout(); throw new ApiError(401, 'UNAUTHORIZED', 'Session expired') }
    ;({ res, json } = await raw(method, path, body, isForm))
  }
  if (!res.ok || !json?.success) {
    const e = json?.error
    throw new ApiError(res.status, e?.code ?? 'ERROR', e?.message ?? `Request failed (${res.status})`, e?.details)
  }
  return { data: json.data, meta: json.meta ?? {} }
}

export async function login(username, password) {
  const { res, json } = await raw('POST', '/auth/login', { username, password })
  if (!res.ok || !json?.success) {
    const e = json?.error
    throw new ApiError(res.status, e?.code ?? 'ERROR', e?.message ?? 'Sign-in failed', e?.details)
  }
  store(json.data)
  return json.data.user
}

export async function logout() {
  try { await api('POST', '/auth/logout', { refreshToken: localStorage.getItem(RT_KEY) ?? undefined }) } catch { /* already gone */ }
  clearSession()
}

export function qs(params) {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, v)
  const s = p.toString()
  return s ? `?${s}` : ''
}
