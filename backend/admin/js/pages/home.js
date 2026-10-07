// Home builder: drag & drop ordering, per-section editor, live preview of the draft, publish and rollback.
import { api } from '../api.js'
import { formModal } from '../form.js'
import { badge, clear, confirmDialog, fail, first, fmtDate, h, modal, pageHead, setDirty, toast, ago } from '../ui.js'

const KINDS = {
  hero: { label: 'Hero banner', icon: '★', fields: [
    { key: 'image', label: 'Background image', type: 'image', nullable: true },
    { key: 'subtitle', label: 'Subtitle', type: 'localized', max: 240 },
    { key: 'badge', label: 'Badge', type: 'localized', max: 30 },
    { key: 'ctaLabel', label: 'Button label', type: 'localized', max: 60 },
    { key: 'ctaUrl', label: 'Button link', type: 'url', placeholder: 'https://…' },
  ] },
  news: { label: 'News carousel', icon: '✎', fields: [{ key: 'limit', label: 'Number of articles', type: 'number', min: 1, max: 10, default: 4 }] },
  servers: { label: 'Featured servers', icon: '⛁', fields: [
    { key: 'mode', label: 'Which servers', type: 'select', options: [['featured', 'Featured only'], ['all', 'All enabled']] },
    { key: 'limit', label: 'Maximum', type: 'number', min: 1, max: 20, default: 6 },
  ] },
  partners: { label: 'Partner banners', icon: '✦', fields: [{ key: 'limit', label: 'Maximum', type: 'number', min: 1, max: 6, default: 3 }] },
  banner: { label: 'Image banner', icon: '▣', fields: [
    { key: 'image', label: 'Image', type: 'image', required: true },
    { key: 'url', label: 'Link', type: 'url', nullable: true },
    { key: 'alt', label: 'Alt text', type: 'localized', max: 120 },
  ] },
  links: { label: 'Quick links', icon: '⇗', fields: [{ key: 'items', label: 'Links (JSON: [{label:{en},url,icon}])', type: 'json', required: true, rows: 7 }] },
  text: { label: 'Text block', icon: '¶', fields: [{ key: 'body', label: 'Text', type: 'localized', multiline: true, max: 1500, required: true }] },
}

const toForm = (s) => {
  const c = s.config
  const base = { title: s.title, enabled: s.enabled, startsAt: s.startsAt, endsAt: s.endsAt, targeting: s.targeting, ...c }
  if (s.kind === 'hero') { base.ctaLabel = c.cta?.label ?? {}; base.ctaUrl = c.cta?.url ?? '' }
  if (s.kind === 'links') base.items = c.items ?? [{ label: { en: 'Website' }, url: 'https://swiftclient.fr' }]
  return base
}

function toPayload(kind, v) {
  const config = {}
  for (const f of KINDS[kind].fields) {
    if (['ctaLabel', 'ctaUrl'].includes(f.key)) continue
    if (v[f.key] !== undefined && v[f.key] !== null) config[f.key] = v[f.key]
  }
  if (kind === 'hero' && v.ctaUrl) {
    if (!v.ctaLabel || !Object.keys(v.ctaLabel).length) throw new Error('Button label is required when a link is set')
    config.cta = { label: v.ctaLabel, url: v.ctaUrl }
  }
  return { kind, title: v.title ?? {}, config, enabled: v.enabled, startsAt: v.startsAt ?? null, endsAt: v.endsAt ?? null, targeting: v.targeting ?? {} }
}

const common = [
  { key: 'title', label: 'Section title', type: 'localized', max: 120 },
  { key: 'enabled', label: 'Enabled', type: 'bool', default: true },
  { key: 'startsAt', label: 'Show from', type: 'datetime', nullable: true, hint: 'Leave empty to show immediately.' },
  { key: 'endsAt', label: 'Hide after', type: 'datetime', nullable: true },
  { key: 'targeting', type: 'targeting' },
]

export default async function render(root, { can }) {
  const canWrite = can('home.write')
  const canPublish = can('home.publish')
  const listEl = h('div', null)
  const previewEl = h('div', { class: 'preview' })
  const statusEl = h('div', null)
  let sections = []
  let published = null
  let dirty = false

  async function load() {
    const d = await api('GET', '/home/sections')
    sections = d.sections
    published = d.publishedSnapshotId
    dirty = d.dirty
    paint()
    loadPreview()
  }

  function paint() {
    clear(statusEl).append(
      dirty ? badge('Unpublished changes', 'warn') : badge(published ? `Live · snapshot #${published}` : 'Nothing published yet', published ? 'ok' : ''))
    clear(listEl)
    if (!sections.length) listEl.append(h('div', { class: 'card empty' }, 'No section yet. Add a hero, news carousel, servers… then publish: until then the launcher keeps its built-in home.'))
    sections.forEach((s, i) => listEl.append(row(s, i)))
  }

  let dragId = null
  function row(s) {
    const k = KINDS[s.kind]
    const win = s.startsAt || s.endsAt ? `${s.startsAt ? fmtDate(s.startsAt) : '…'} → ${s.endsAt ? fmtDate(s.endsAt) : '…'}` : null
    const el = h('div', { class: `sec ${s.enabled ? '' : 'disabled'}`, draggable: canWrite ? 'true' : null },
      h('span', { class: 'grip' }, '⠿'),
      h('span', { style: { fontSize: '20px', width: '26px', textAlign: 'center' } }, k.icon),
      h('div', { class: 'info' }, h('b', null, first(s.title) || k.label), h('span', null, [k.label, win, Object.keys(s.targeting).length ? 'targeted' : null].filter(Boolean).join(' · '))),
      !s.enabled ? badge('hidden') : null,
      canWrite ? h('button', { class: 'btn sm', onclick: () => edit(s) }, 'Edit') : null,
      canWrite ? h('button', { class: 'btn sm danger', onclick: () => remove(s) }, 'Delete') : null)
    if (canWrite) {
      el.addEventListener('dragstart', (e) => { dragId = s.id; el.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move' })
      el.addEventListener('dragend', () => { dragId = null; el.classList.remove('dragging'); listEl.querySelectorAll('.over').forEach(x => x.classList.remove('over')) })
      el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('over') })
      el.addEventListener('dragleave', () => el.classList.remove('over'))
      el.addEventListener('drop', async (e) => {
        e.preventDefault()
        if (!dragId || dragId === s.id) return
        const ids = sections.map(x => x.id).filter(id => id !== dragId)
        ids.splice(ids.indexOf(s.id), 0, dragId)
        try { await api('PUT', '/home/sections/order', { ids }); await load() } catch (err) { fail(err) }
      })
    }
    return el
  }

  async function loadPreview() {
    try {
      const { sections: pv } = await api('GET', '/home/preview?locale=en&os=windows&arch=x64&v=99.0.0&auth=1')
      clear(previewEl).append(h('div', { class: 'faint', style: { marginBottom: '8px' } }, 'Draft as seen by a signed-in Windows launcher (English)'))
      if (!pv.length) previewEl.append(h('div', { class: 'faint' }, 'Nothing would be shown.'))
      for (const s of pv) previewEl.append(h('div', { class: 'pv-sec' }, h('div', { class: 'k' }, s.kind),
        s.title ? h('b', null, s.title) : null,
        s.subtitle ? h('div', { class: 'muted' }, s.subtitle) : null, s.body ? h('div', { class: 'muted' }, s.body) : null,
        s.imageUrl ? h('img', { src: s.imageUrl, alt: '' }) : null,
        s.cta ? h('div', null, badge(`${s.cta.label} → ${s.cta.url}`, 'blue')) : null,
        s.items ? h('div', { class: 'faint' }, `${s.items.length} item(s)`, s.items.slice(0, 4).map(i => h('div', null, '• ', i.title ?? i.name ?? i.label))) : null))
    } catch (e) { clear(previewEl).append(h('div', { class: 'faint' }, 'Preview unavailable')) }
  }

  function edit(s) {
    const kind = s?.kind
    formModal({
      title: s ? `Edit ${KINDS[kind].label}` : `New ${KINDS[currentKind].label}`, wide: true, submit: s ? 'Save' : 'Add section',
      fields: [...KINDS[kind ?? currentKind].fields, { key: 'h', label: 'Display', type: 'heading' }, ...common],
      initial: s ? toForm(s) : { enabled: true },
      onSubmit: async (v) => {
        const body = toPayload(kind ?? currentKind, v)
        if (s) await api('PUT', `/home/sections/${s.id}`, body)
        else await api('POST', '/home/sections', body)
        toast('Saved to the draft', 'ok')
        await load()
      },
    })
  }

  let currentKind = 'hero'
  function add() {
    const sel = h('select', null, Object.entries(KINDS).map(([k, v]) => h('option', { value: k }, `${v.icon}  ${v.label}`)))
    modal({ title: 'Add a section', body: h('div', { class: 'field' }, h('label', null, 'Type'), sel),
      actions: [{ label: 'Cancel' }, { label: 'Continue', kind: 'primary', run: () => { currentKind = sel.value; setTimeout(() => edit(null), 0) } }] })
  }

  async function remove(s) {
    if (!(await confirmDialog('Delete section', `Delete "${first(s.title) || KINDS[s.kind].label}" from the draft? The live home is not affected until you publish.`, { danger: true, label: 'Delete' }))) return
    try { await api('DELETE', `/home/sections/${s.id}`); await load() } catch (e) { fail(e) }
  }

  async function publish() {
    const note = h('input', { type: 'text', placeholder: 'What changed? (optional)', maxlength: 200 })
    modal({ title: 'Publish the home', body: h('div', null, h('p', { class: 'muted' }, 'This replaces what every launcher sees. You can roll back at any time from the history.'), h('div', { class: 'field' }, h('label', null, 'Note'), note)),
      actions: [{ label: 'Cancel' }, { label: 'Publish now', kind: 'primary', run: async () => { await api('POST', '/home/publish', { note: note.value.trim() || undefined }); toast('Home published', 'ok'); await load() } }] })
  }

  async function history() {
    const snaps = await api('GET', '/home/snapshots')
    modal({ title: 'Publication history', wide: true, body: h('div', null, snaps.length ? snaps.map(s => h('div', { class: 'sec', style: { cursor: 'default' } },
      h('div', { class: 'info' }, h('b', null, `#${s.id} · ${s.note || 'no note'}`), h('span', null, `${fmtDate(s.createdAt)} (${ago(s.createdAt)}) · ${s.createdBy ?? 'unknown'} · ${s.sections} sections`)),
      s.active ? badge('live', 'ok') : (canPublish ? h('button', { class: 'btn sm', onclick: async (ev) => {
        if (!(await confirmDialog('Roll back', `Make snapshot #${s.id} live again and restore it as the draft?`, { label: 'Roll back' }))) return
        try { await api('POST', `/home/snapshots/${s.id}/rollback`, {}); toast('Rolled back', 'ok'); ev.target.closest('.overlay')?.remove(); await load() } catch (e) { fail(e) }
      } }, 'Roll back') : null))) : h('div', { class: 'empty' }, 'Nothing published yet.')) })
  }

  root.append(pageHead('Home builder', 'Compose the launcher home. Edits are drafts until you publish.',
    statusEl, h('button', { class: 'btn', onclick: history }, 'History'),
    canWrite ? h('button', { class: 'btn', onclick: add }, '+ Add section') : null,
    canPublish ? h('button', { class: 'btn primary', onclick: publish }, 'Publish') : null))
  root.append(h('div', { class: 'builder' }, h('div', null, listEl, canWrite ? h('div', { class: 'faint', style: { marginTop: '6px' } }, 'Drag sections to reorder.') : null), h('div', null, h('h3', { class: 'muted', style: { margin: '0 0 8px' } }, 'Live preview'), previewEl)))
  setDirty(false)
  await load()
}
