// Shell: login, navigation (filtered by permissions), hash router, command palette (Ctrl/Cmd+K), notifications.
import { api, hasSession, login, logout, setLogoutHandler } from './api.js'
import { lang, setLang } from './i18n.js'
import { $, badge, clear, confirmDialog, debounce, fail, h, isDirty, setDirty, skeleton, toast, ago, errorMessage } from './ui.js'

const NAV = [
  ['Overview', [['dashboard', 'Dashboard', '◈', null]]],
  ['Content', [
    ['home', 'Home builder', '▦', 'home.read'], ['news', 'News & changelog', '✎', 'news.read'], ['announcements', 'Announcements', '⚑', 'announcements.read'], ['assets', 'Assets', '▣', 'assets.read'],
  ]],
  ['Network', [
    ['servers', 'Servers', '⛁', 'servers.read'], ['partners', 'Partners', '✦', 'partners.read'], ['campaigns', 'Campaigns', '➤', 'partners.read'],
  ]],
  ['Launcher', [
    ['releases', 'Releases', '⇪', 'releases.read'], ['flags', 'Flags & config', '⚐', 'config.read'], ['maintenance', 'Maintenance', '⚒', 'settings.read'],
  ]],
  ['Insights', [
    ['analytics', 'Analytics', '▥', 'analytics.read'], ['diagnostics', 'Diagnostics', '✚', 'diagnostics.read'],
  ]],
  ['Platform', [
    ['users', 'Users & roles', '☺', 'users.read'], ['audit', 'Audit log', '☰', 'audit.read'], ['webhooks', 'Webhooks', '⇄', 'webhooks.manage'], ['settings', 'Settings', '⚙', null],
  ]],
]

const state = { user: null, can: () => false }

/** FR / EN switch. The whole panel is re-rendered by a reload; the session survives it. */
function langSwitch() {
  return h('select', { class: 'langsel', 'aria-label': 'Language', title: 'Language', onchange: async (e) => {
    if (isDirty() && !(await confirmDialog('Discard changes?', 'You have unsaved changes that will be lost.', { danger: true, label: 'Discard' }))) { e.target.value = lang; return }
    setLang(e.target.value)
    location.reload()
  } }, [['fr', 'Français'], ['en', 'English']].map(([v, l]) => h('option', { value: v, selected: v === lang }, l)))
}
document.documentElement.lang = lang
const app = $('#app')

setLogoutHandler(() => { state.user = null; renderLogin('Your session expired. Please sign in again.') })

function renderLogin(message) {
  clear(app)
  const user = h('input', { type: 'text', autocomplete: 'username', placeholder: 'Swift username', required: true })
  const pass = h('input', { type: 'password', autocomplete: 'current-password', placeholder: 'Password', required: true })
  const err = h('div', { class: 'banner bad', style: { display: message ? '' : 'none' } }, message ?? '')
  const btn = h('button', { class: 'btn primary', type: 'submit', style: { width: '100%', justifyContent: 'center', marginTop: '6px' } }, 'Sign in')
  const form = h('form', { onsubmit: async (e) => {
    e.preventDefault()
    btn.disabled = true
    err.style.display = 'none'
    try { await login(user.value.trim(), pass.value); await boot() } catch (x) { err.textContent = errorMessage(x); err.style.display = '' } finally { btn.disabled = false }
  } }, err, h('div', { class: 'field' }, h('label', null, 'Username'), user), h('div', { class: 'field' }, h('label', null, 'Password'), pass), btn)
  app.append(h('div', { class: 'login' }, h('div', { class: 'box card' },
    h('img', { src: '/admin/logo.png', width: 52, height: 52, alt: '', style: { borderRadius: '12px' } }),
    h('div', { style: { float: 'right' } }, langSwitch()), h('h1', null, 'Swift Platform'), h('p', { class: 'muted', style: { margin: '0 0 16px' } }, 'Sign in with a Swift account that holds a platform role.'), form)))
  user.focus()
}

async function boot() {
  try {
    const me = await api('GET', '/auth/me')
    state.user = me
    const perms = new Set(me.permissions)
    state.can = (p) => !p || perms.has(p)
    renderShell()
    route()
  } catch (e) {
    if (e.status === 401 || e.status === 403) renderLogin(hasSession() ? undefined : undefined)
    else renderLogin(errorMessage(e))
  }
}

function renderShell() {
  clear(app)
  const nav = h('nav', { class: 'nav' }, NAV.flatMap(([group, items]) => {
    const visible = items.filter(i => state.can(i[3]))
    return visible.length ? [h('div', { class: 'nav-group' }, group), ...visible.map(([id, label, ico]) => h('a', { href: `#/${id}`, 'data-id': id }, h('span', { class: 'ico' }, ico), label))] : []
  }))
  const side = h('aside', { class: 'side' }, h('div', { class: 'brand' }, h('img', { src: '/admin/logo.png', alt: '' }), h('div', null, 'SWIFT', h('small', null, 'Platform admin'))), nav)
  const bell = h('div', { class: 'bell', role: 'button', tabindex: 0, title: 'Notifications' }, '🔔')
  const dropdown = h('div', { class: 'dropdown', style: { display: 'none' } })
  const top = h('header', { class: 'top' },
    h('div', { class: 'searchbtn', onclick: openPalette, role: 'button', tabindex: 0 }, '⌕', h('span', null, 'Search everything…'), h('span', { style: { marginLeft: 'auto' } }, h('kbd', null, 'Ctrl'), ' ', h('kbd', null, 'K'))),
    h('div', { class: 'spacer' }),
    langSwitch(),
    h('div', { style: { position: 'relative' } }, bell, dropdown),
    h('div', { class: 'muted' }, state.user.username, ' ', ...state.user.roles.map(r => badge(r, 'blue'))),
    h('button', { class: 'btn sm', onclick: async () => { if (await confirmDialog('Sign out', 'End this session?')) { await logout(); renderLogin() } } }, 'Sign out'))
  const content = h('main', { class: 'content', id: 'content' })
  app.append(h('div', { class: 'shell' }, side, h('div', { class: 'main' }, top, content)))
  setupBell(bell, dropdown)
}

// ---- Notifications ---------------------------------------------------------------------------------------
async function setupBell(bell, dropdown) {
  const load = async () => {
    try {
      const d = await api('GET', '/notifications')
      bell.querySelector('.dot')?.remove()
      if (d.unread) bell.append(h('span', { class: 'dot' }, d.unread))
      clear(dropdown).append(...(d.items.length ? d.items.map(n => h('div', { class: `note ${n.read ? '' : 'unread'}` },
        h('div', { class: 'flex between' }, h('b', null, n.title), badge(n.level, n.level === 'critical' ? 'bad' : n.level === 'warning' ? 'warn' : n.level === 'success' ? 'ok' : '')),
        n.body ? h('div', { class: 'muted' }, n.body) : null, h('div', { class: 'faint' }, ago(n.at)))) : [h('div', { class: 'empty' }, 'No notifications')]))
    } catch { /* offline */ }
  }
  bell.addEventListener('click', async () => {
    const open = dropdown.style.display === 'none'
    dropdown.style.display = open ? '' : 'none'
    if (open) { await load(); await api('POST', '/notifications/read', {}).catch(() => {}); bell.querySelector('.dot')?.remove() }
  })
  document.addEventListener('click', (e) => { if (!bell.parentElement.contains(e.target)) dropdown.style.display = 'none' })
  load()
  const timer = setInterval(() => { if (!document.body.contains(bell)) clearInterval(timer); else if (dropdown.style.display === 'none') load() }, 60000)
}

// ---- Router ------------------------------------------------------------------------------------------------
let currentPage = 0
async function route() {
  const id = (location.hash.replace(/^#\//, '').split('/')[0]) || 'dashboard'
  const known = NAV.flatMap(([, items]) => items).find(i => i[0] === id)
  const content = $('#content')
  if (!content) return
  document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('active', a.dataset.id === id))
  if (!known || !state.can(known[3])) { clear(content).append(h('div', { class: 'empty' }, 'This page does not exist or you do not have access to it.')); return }
  const mine = ++currentPage
  clear(content).append(skeleton())
  try {
    const mod = await import(`/admin/js/pages/${id}.js`)
    if (mine !== currentPage) return
    const root = h('div', null)
    await mod.default(root, { user: state.user, can: state.can })
    if (mine !== currentPage) return
    clear(content).append(root)
  } catch (e) {
    if (mine !== currentPage) return
    clear(content).append(h('div', { class: 'banner bad' }, errorMessage(e)))
  }
}

let lastHash = location.hash
window.addEventListener('hashchange', async () => {
  if (isDirty() && !(await confirmDialog('Leave this page?', 'You have unsaved changes that will be lost.', { danger: true, label: 'Leave' }))) {
    history.replaceState(null, '', lastHash || '#/dashboard')
    return
  }
  setDirty(false)
  lastHash = location.hash
  if (state.user) route()
})

// ---- Command palette (Ctrl/Cmd+K) ----------------------------------------------------------------------
function openPalette() {
  if (!state.user || document.querySelector('.palette')) return
  const input = h('input', { type: 'search', placeholder: 'Search news, servers, partners, releases, users, flags… or jump to a page', autocomplete: 'off' })
  const list = h('div', { class: 'hits' })
  const overlay = h('div', { class: 'overlay', onmousedown: (e) => { if (e.target === overlay) close() } }, h('div', { class: 'palette' }, input, list))
  let items = []
  let sel = 0
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey, true) }
  const go = (it) => { close(); location.hash = it.link }
  const paint = () => {
    clear(list).append(...(items.length ? items.map((it, i) => h('div', { class: `hit ${i === sel ? 'sel' : ''}`, onclick: () => go(it), onmousemove: () => { sel = i; paintSel() } },
      badge(it.type), h('span', { class: 't' }, it.title), it.subtitle ? h('span', { class: 's' }, it.subtitle) : null)) : [h('div', { class: 'empty' }, input.value.length < 2 ? 'Type at least 2 characters' : 'No results')]))
  }
  const paintSel = () => [...list.children].forEach((c, i) => c.classList.toggle('sel', i === sel))
  const pages = NAV.flatMap(([, it]) => it).filter(i => state.can(i[3])).map(([id, label]) => ({ type: 'page', title: label, link: `#/${id}`, id }))
  const search = debounce(async () => {
    const q = input.value.trim()
    const matchPages = pages.filter(p => p.title.toLowerCase().includes(q.toLowerCase())).slice(0, 4)
    let hits = []
    if (q.length >= 2) { try { hits = await api('GET', `/search?q=${encodeURIComponent(q)}`) } catch (e) { fail(e) } }
    items = [...matchPages, ...hits]
    sel = 0
    paint()
  }, 160)
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); paintSel() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); paintSel() }
    else if (e.key === 'Enter' && items[sel]) { e.preventDefault(); go(items[sel]) }
  }
  input.addEventListener('input', search)
  document.addEventListener('keydown', onKey, true)
  document.body.append(overlay)
  input.focus()
  items = pages.slice(0, 8)
  paint()
}

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette() }
})

if (hasSession()) boot()
else renderLogin()

export { state, toast }
