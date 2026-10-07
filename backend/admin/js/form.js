// Schema-driven forms. buildForm(fields, initial) -> { el, get() }. get() throws Error(message) on a missing required field.
import { api, qs } from './api.js'
import { h, modal, setDirty, isDirty, toast, fail, clear, debounce, confirmDialog } from './ui.js'

const LOCALES = ['en', 'fr', 'es', 'de', 'pt', 'it', 'ru', 'zh', 'ja', 'ko', 'pl', 'nl', 'tr']
const OS = ['windows', 'macos', 'linux']
const ARCH = ['x64', 'arm64', 'x86']
const CHANNELS = ['stable', 'beta', 'canary', 'development']

const toLocalInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function wrap(f, control, extra) {
  return h('div', { class: 'field' }, f.label ? h('label', null, f.label, f.required ? ' *' : '') : null, control, f.hint ? h('div', { class: 'hint' }, f.hint) : null, extra)
}

const builders = {
  text(f, v) {
    const i = h('input', { type: f.type === 'url' ? 'url' : 'text', value: v ?? '', placeholder: f.placeholder, maxlength: f.max, autocomplete: 'off', spellcheck: 'false' })
    return { el: wrap(f, i), get: () => i.value.trim() }
  },
  textarea(f, v) {
    const i = h('textarea', { rows: f.rows ?? 4, placeholder: f.placeholder, maxlength: f.max }, v ?? '')
    return { el: wrap(f, i), get: () => i.value.trim() }
  },
  number(f, v) {
    const i = h('input', { type: 'number', value: v ?? f.default ?? '', min: f.min, max: f.max, step: f.step ?? 1 })
    return { el: wrap(f, i), get: () => (i.value === '' ? '' : Number(i.value)) }
  },
  bool(f, v) {
    const i = h('input', { type: 'checkbox', checked: v ?? f.default ?? false })
    return { el: h('div', { class: 'field' }, h('label', { class: 'check' }, i, f.label), f.hint ? h('div', { class: 'hint' }, f.hint) : null), get: () => i.checked, bool: true }
  },
  select(f, v) {
    const s = h('select', null, f.options.map(([val, label]) => h('option', { value: val, selected: String(val) === String(v ?? f.default ?? f.options[0][0]) }, label)))
    return { el: wrap(f, s), get: () => s.value }
  },
  datetime(f, v) {
    const i = h('input', { type: 'datetime-local', value: toLocalInput(v) })
    return { el: wrap(f, i), get: () => (i.value ? new Date(i.value).toISOString() : '') }
  },
  tags(f, v) {
    const i = h('input', { type: 'text', value: (v ?? []).join(', '), placeholder: f.placeholder ?? 'comma separated' })
    return { el: wrap(f, i), get: () => i.value.split(',').map(s => s.trim()).filter(Boolean) }
  },
  multi(f, v) {
    const set = new Set(v ?? [])
    const boxes = f.options.map(o => ({ o, i: h('input', { type: 'checkbox', checked: set.has(o) }) }))
    return { el: wrap(f, h('div', { class: 'flex', style: { flexWrap: 'wrap' } }, boxes.map(b => h('label', { class: 'check' }, b.i, b.o)))), get: () => boxes.filter(b => b.i.checked).map(b => b.o) }
  },
  localized(f, v) {
    const value = { ...(v ?? {}) }
    const rows = h('div', { class: 'loc' })
    const codes = [...new Set([...(f.locales ?? ['en', 'fr']), ...Object.keys(value)])]
    const inputs = new Map()
    const addRow = (code) => {
      if (inputs.has(code)) return
      const i = f.multiline ? h('textarea', { rows: 3, maxlength: f.max }, value[code] ?? '') : h('input', { type: 'text', value: value[code] ?? '', maxlength: f.max })
      inputs.set(code, i)
      rows.append(h('div', { class: 'loc-row' }, h('div', { class: 'code' }, code), i))
    }
    codes.forEach(addRow)
    const add = h('select', { onchange: (e) => { if (e.target.value) { addRow(e.target.value); e.target.value = '' } } },
      h('option', { value: '' }, '+ language'), LOCALES.filter(l => !inputs.has(l)).map(l => h('option', { value: l }, l)))
    return { el: wrap(f, rows, add), get: () => Object.fromEntries([...inputs].map(([k, i]) => [k, i.value.trim()]).filter(([, t]) => t)) }
  },
  image(f, v) {
    const i = h('input', { type: 'text', value: v ?? '', placeholder: 'asset:… or https://…', autocomplete: 'off' })
    const thumb = h('div', { class: 'thumb', style: { width: '120px', display: v ? '' : 'none' } }, h('div', { class: 'im' }))
    const refresh = debounce(async () => {
      const val = i.value.trim()
      thumb.style.display = val ? '' : 'none'
      let url = val.startsWith('https://') ? val : ''
      if (val.startsWith('asset:')) { try { url = (await api('GET', `/assets/${val.slice(6)}`)).url } catch { url = '' } }
      thumb.firstChild.style.backgroundImage = url ? `url("${url.replace(/"/g, '%22')}")` : ''
    }, 300)
    i.addEventListener('input', refresh)
    refresh()
    const pick = h('button', { class: 'btn sm', type: 'button', onclick: () => pickAsset((a) => { i.value = a.ref; i.dispatchEvent(new Event('input', { bubbles: true })) }) }, 'Choose from library')
    return { el: wrap(f, h('div', { class: 'flex' }, i, pick), thumb), get: () => i.value.trim() }
  },
  targeting(f, v) {
    const t = v ?? {}
    const lvMin = h('input', { type: 'text', value: t.launcherVersion?.min ?? '', placeholder: 'min e.g. 1.2.0' })
    const lvMax = h('input', { type: 'text', value: t.launcherVersion?.max ?? '', placeholder: 'max e.g. 1.9.0' })
    const mc = h('input', { type: 'text', value: (t.mcVersions ?? []).join(', '), placeholder: '1.21.4, 1.21.1' })
    const loc = h('input', { type: 'text', value: (t.locales ?? []).join(', '), placeholder: 'fr, en' })
    const os = builders.multi({ options: OS }, t.os)
    const arch = builders.multi({ options: ARCH }, t.arch)
    const ch = builders.multi({ options: CHANNELS }, t.channels)
    const auth = h('select', null, [['', 'Everyone'], ['true', 'Signed in only'], ['false', 'Signed out only']].map(([val, l]) => h('option', { value: val, selected: String(t.authenticated ?? '') === val }, l)))
    const roll = h('input', { type: 'number', min: 0, max: 100, value: t.rolloutPercent ?? '', placeholder: '100' })
    const field = (label, c) => h('div', { class: 'field' }, h('label', null, label), c)
    const body = h('div', { class: 'card', style: { padding: '12px' } },
      h('div', { class: 'row' }, field('Launcher version ≥', lvMin), field('Launcher version ≤', lvMax)),
      h('div', { class: 'row' }, field('Minecraft versions', mc), field('Locales', loc)),
      field('Operating system', os.el.querySelector('.flex')), field('Architecture', arch.el.querySelector('.flex')), field('Channels', ch.el.querySelector('.flex')),
      h('div', { class: 'row' }, field('Audience', auth), field('Rollout % (stable per device)', roll)))
    return {
      el: wrap({ label: f.label ?? 'Targeting', hint: 'Empty = everyone. Criteria are combined with AND.' }, body),
      get() {
        const out = {}
        if (lvMin.value.trim() || lvMax.value.trim()) out.launcherVersion = { ...(lvMin.value.trim() ? { min: lvMin.value.trim() } : {}), ...(lvMax.value.trim() ? { max: lvMax.value.trim() } : {}) }
        const list = (s) => s.split(',').map(x => x.trim()).filter(Boolean)
        if (list(mc.value).length) out.mcVersions = list(mc.value)
        if (list(loc.value).length) out.locales = list(loc.value)
        if (os.get().length) out.os = os.get()
        if (arch.get().length) out.arch = arch.get()
        if (ch.get().length) out.channels = ch.get()
        if (auth.value) out.authenticated = auth.value === 'true'
        if (roll.value !== '') out.rolloutPercent = Number(roll.value)
        return out
      },
    }
  },
  json(f, v) {
    const i = h('textarea', { rows: f.rows ?? 5, class: 'mono' }, v === undefined ? '' : JSON.stringify(v, null, 2))
    return { el: wrap(f, i), get: () => { try { return JSON.parse(i.value) } catch { throw new Error(`${f.label}: invalid JSON`) } } }
  },
  heading(f) {
    return { el: h('h3', { style: { margin: '18px 0 8px' } }, f.label), get: () => undefined, skip: true }
  },
}

export function buildForm(fields, initial = {}) {
  const root = h('div', null)
  const parts = fields.map((f) => {
    const type = f.type ?? 'text'
    const b = (builders[type] ?? builders.text)(f, initial[f.key])
    root.append(b.el)
    return { f, b, type }
  })
  root.addEventListener('input', () => setDirty(true))
  root.addEventListener('change', () => setDirty(true))
  return {
    el: root,
    get() {
      const out = {}
      for (const { f, b, type } of parts) {
        if (b.skip) continue
        const v = b.get()
        const empty = v === '' || v === undefined || (Array.isArray(v) && !v.length) || (type === 'localized' && !Object.keys(v).length)
        if (empty) {
          if (f.required) throw new Error(`${f.label} is required`)
          if (f.nullable) out[f.key] = null
          else if (type === 'localized' || type === 'tags') out[f.key] = type === 'tags' ? [] : {}
          continue
        }
        out[f.key] = v
      }
      return out
    },
  }
}

/** Opens a modal with a form. onSubmit(values) may throw to keep the dialog open. */
export function formModal({ title, fields, initial, onSubmit, submit = 'Save', wide = false, extra }) {
  const form = buildForm(fields, initial)
  setDirty(false)
  return modal({
    title, wide, body: h('div', null, form.el, extra),
    guard: () => isDirty(),
    onClose: () => setDirty(false),
    actions: [
      { label: 'Cancel', run: async () => { if (isDirty() && !(await confirmDialog('Discard changes?', 'You have unsaved changes that will be lost.', { danger: true, label: 'Discard' }))) return false } },
      { label: submit, kind: 'primary', run: async () => {
        let values
        try { values = form.get() } catch (e) { toast(e.message, 'err'); return false }
        await onSubmit(values)
        setDirty(false)
      } },
    ],
  })
}

// ---- Asset picker --------------------------------------------------------------------------------------
export function pickAsset(onPick) {
  const grid = h('div', { class: 'thumbs' })
  const search = h('input', { type: 'search', placeholder: 'Search assets…' })
  let m
  const load = async () => {
    try {
      const items = await api('GET', `/assets${qs({ q: search.value, limit: 60 })}`)
      clear(grid).append(...(items.length ? items.map(a => h('div', { class: 'thumb', onclick: () => { onPick(a); m.close?.() } },
        h('div', { class: 'im', style: { backgroundImage: `url("${a.url}")` } }), h('div', { class: 'meta' }, h('b', null, a.filename), `${a.width}×${a.height}`))) : [h('div', { class: 'empty' }, 'No assets yet. Upload one in the Assets page.')]))
    } catch (e) { fail(e) }
  }
  search.addEventListener('input', debounce(load))
  const upload = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', style: { display: 'none' }, onchange: async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    try { const a = await api('POST', '/assets', fd, true); toast('Uploaded', 'ok'); onPick(a); m.close?.() } catch (err) { fail(err) }
  } })
  m = modal({ title: 'Asset library', wide: true, body: h('div', null, h('div', { class: 'toolbar' }, search, h('button', { class: 'btn primary', onclick: () => upload.click() }, 'Upload image'), upload), grid) })
  const wrapper = m.el
  m.close = () => wrapper.remove()
  load()
}
