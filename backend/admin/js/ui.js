import { tr, locale } from './i18n.js'

// Tiny DOM toolkit. Everything goes through textContent / setAttribute: no innerHTML with data, ever.
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === undefined || v === null || v === false) continue
    if (k === 'class') el.className = v
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v)
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v)
    else if (k === 'value') el.value = v
    else if (k === 'checked' || k === 'disabled' || k === 'selected') el[k] = !!v
    else el.setAttribute(k, v === true ? '' : (['placeholder', 'title', 'aria-label', 'alt'].includes(k) ? tr(String(v)) : v))
  }
  add(el, children)
  return el
}

// Fields and code blocks hold data, never UI text: leave them alone.
const RAW = new Set(['TEXTAREA', 'PRE', 'CODE', 'INPUT', 'SCRIPT', 'STYLE'])

function add(el, children) {
  const raw = RAW.has(el.tagName)
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue
    el.append(c instanceof Node ? c : document.createTextNode(typeof c === 'string' && !raw ? tr(c) : String(c)))
  }
}

export const $ = (sel, root = document) => root.querySelector(sel)
export function clear(el) { while (el.firstChild) el.firstChild.remove(); return el }

// ---- Toasts ----------------------------------------------------------------------------------------
export function toast(message, kind = 'info', ms = 3800) {
  const t = h('div', { class: `toast ${kind}` }, message)
  $('#toasts').append(t)
  setTimeout(() => t.remove(), ms)
}

export function errorMessage(e) {
  const message = tr(e?.message ?? '')
  if (e?.details?.length) return `${message}: ${e.details.slice(0, 3).map(d => `${d.path || 'field'} ${d.message}`).join('; ')}`
  return message || tr('Something went wrong')
}
export const fail = (e) => toast(errorMessage(e), 'err', 6000)

// ---- Unsaved changes guard -------------------------------------------------------------------------
let dirty = false
export const setDirty = (v) => { dirty = v }
export const isDirty = () => dirty
window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = '' } })

// ---- Modal -----------------------------------------------------------------------------------------
export function modal({ title, body, actions = [], wide = false, onClose, guard }) {
  const finish = () => { overlay.remove(); document.removeEventListener('keydown', esc); onClose?.() }
  // `close` is what the X, Escape and the backdrop use: it asks first when there are unsaved edits.
  const close = async () => {
    if (guard?.() && !(await confirmDialog('Discard changes?', 'You have unsaved changes that will be lost.', { danger: true, label: 'Discard' }))) return
    finish()
  }
  const esc = (e) => { if (e.key === 'Escape' && overlay.isConnected && overlay === [...document.querySelectorAll('.overlay')].pop()) close() }
  const foot = h('div', { class: 'modal-foot' }, actions.map(a => h('button', {
    class: `btn ${a.kind ?? ''}`, type: 'button',
    onclick: async (ev) => {
      const btn = ev.currentTarget
      btn.disabled = true
      try { const keep = await a.run?.(finish); if (keep !== false && a.close !== false) finish() } catch (e) { fail(e) } finally { btn.disabled = false }
    },
  }, a.label)))
  const overlay = h('div', { class: 'overlay', onmousedown: (e) => { if (e.target === overlay) close() } },
    h('div', { class: `modal ${wide ? 'wide' : ''}`, role: 'dialog', 'aria-modal': 'true' },
      h('div', { class: 'modal-head' }, h('h2', null, title), h('button', { class: 'btn ghost sm', onclick: close, 'aria-label': 'Close' }, '✕')),
      h('div', { class: 'modal-body' }, body),
      actions.length ? foot : null))
  document.addEventListener('keydown', esc)
  document.body.append(overlay)
  const first = overlay.querySelector('input,select,textarea')
  first?.focus()
  return { close, el: overlay }
}

export function confirmDialog(title, message, { danger = false, label = 'Confirm' } = {}) {
  return new Promise((resolve) => {
    let done = false
    const finish = (v) => { if (!done) { done = true; resolve(v) } }
    modal({
      title, body: h('p', { class: 'muted' }, message), onClose: () => finish(false),
      actions: [{ label: 'Cancel', run: () => finish(false) }, { label, kind: danger ? 'danger' : 'primary', run: () => finish(true) }],
    })
  })
}

// ---- Misc helpers ----------------------------------------------------------------------------------
export function skeleton(rows = 4) {
  return h('div', null, h('div', { class: 'skeleton h' }), Array.from({ length: rows }, () => h('div', { class: 'skeleton' })))
}

export const badge = (text, kind = '') => h('span', { class: `badge ${kind}` }, text)

const STATUS_KIND = { published: 'ok', active: 'ok', open: 'warn', draft: 'warn', scheduled: 'blue', archived: '', revoked: 'bad', resolved: 'ok', failed: 'bad', success: 'ok', pending: 'warn', ended: '', paused: 'warn', ignored: '' }
export const statusBadge = (s) => badge(s, STATUS_KIND[s] ?? '')

export function fmtDate(iso) {
  if (!iso) return '–'
  const d = new Date(iso)
  return Number.isNaN(+d) ? '–' : d.toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' })
}

export function ago(iso) {
  if (!iso) return 'never'
  const s = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  if (s < 86400) return `${Math.round(s / 3600)}h ago`
  return `${Math.round(s / 86400)}d ago`
}

export const num = (n) => (n ?? 0).toLocaleString(locale())
export const first = (loc) => (loc && (loc.en || loc.fr || Object.values(loc)[0])) || ''

export function pager(meta, go) {
  if (!meta || !meta.pages || meta.pages <= 1) return h('div', { class: 'pager' }, `${num(meta?.total ?? 0)} item${meta?.total === 1 ? '' : 's'}`)
  return h('div', { class: 'pager' },
    h('span', null, `${num(meta.total)} items · page ${meta.page}/${meta.pages}`),
    h('button', { class: 'btn sm', disabled: meta.page <= 1, onclick: () => go(meta.page - 1) }, '‹ Prev'),
    h('button', { class: 'btn sm', disabled: meta.page >= meta.pages, onclick: () => go(meta.page + 1) }, 'Next ›'))
}

export function table(columns, rows, { empty = 'Nothing here yet.' } = {}) {
  if (!rows.length) return h('div', { class: 'table-wrap' }, h('div', { class: 'empty' }, empty))
  return h('div', { class: 'table-wrap' }, h('table', null,
    h('thead', null, h('tr', null, columns.map(c => h('th', null, c.label)))),
    h('tbody', null, rows.map(r => h('tr', null, columns.map(c => h('td', { class: c.class }, c.render ? c.render(r) : r[c.key])))))))
}

export function debounce(fn, ms = 250) {
  let t
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms) }
}

export function pageHead(title, subtitle, ...actions) {
  return h('div', { class: 'page-head' }, h('div', null, h('h1', null, title), subtitle ? h('p', null, subtitle) : null), h('div', { class: 'actions' }, actions))
}

export function tabs(items, active, onChange) {
  return h('div', { class: 'tabs' }, items.map(([key, label]) => h('button', { class: `tab ${key === active ? 'active' : ''}`, onclick: () => onChange(key) }, label)))
}

export function jsonView(value) {
  return h('pre', { class: 'mono', style: { whiteSpace: 'pre-wrap', margin: 0, maxHeight: '320px', overflow: 'auto' } }, JSON.stringify(value, null, 2))
}
