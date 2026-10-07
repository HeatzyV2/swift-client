import { api } from '../api.js'
import { formModal } from '../form.js'
import { badge, confirmDialog, fail, first, fmtDate, h, pageHead, table, toast, clear } from '../ui.js'

const KIND = { info: '', success: 'ok', warning: 'warn', critical: 'bad' }

const fields = [
  { key: 'type', label: 'Severity', type: 'select', options: [['info', 'Info'], ['success', 'Success'], ['warning', 'Warning'], ['critical', 'Critical']] },
  { key: 'title', label: 'Title', type: 'localized', max: 120, required: true },
  { key: 'body', label: 'Message', type: 'localized', multiline: true, max: 500 },
  { key: 'linkUrl', label: 'Link', type: 'url', nullable: true },
  { key: 'dismissible', label: 'Players can dismiss it', type: 'bool', default: true },
  { key: 'enabled', label: 'Enabled', type: 'bool', default: true },
  { key: 'startsAt', label: 'Show from', type: 'datetime', nullable: true },
  { key: 'endsAt', label: 'Hide after', type: 'datetime', nullable: true },
  { key: 'targeting', type: 'targeting' },
]

export default async function render(root, { can }) {
  const holder = h('div', null)
  const w = can('announcements.write')
  async function load() {
    const items = await api('GET', '/announcements')
    const now = Date.now()
    clear(holder).append(table([
      { label: 'Severity', render: a => badge(a.type, KIND[a.type]) },
      { label: 'Title', render: a => h('b', null, first(a.title)) },
      { label: 'State', render: a => {
        if (!a.enabled) return badge('off')
        if (a.startsAt && Date.parse(a.startsAt) > now) return badge('scheduled', 'blue')
        if (a.endsAt && Date.parse(a.endsAt) <= now) return badge('ended')
        return badge('live', 'ok')
      } },
      { label: 'Window', render: a => (a.startsAt || a.endsAt) ? `${a.startsAt ? fmtDate(a.startsAt) : '…'} → ${a.endsAt ? fmtDate(a.endsAt) : '…'}` : 'Always' },
      { label: 'Audience', render: a => Object.keys(a.targeting).length ? 'Targeted' : 'Everyone' },
      { label: '', class: 'actions-cell', render: a => w ? h('div', { class: 'flex', style: { justifyContent: 'flex-end' } }, h('button', { class: 'btn sm', onclick: () => edit(a) }, 'Edit'),
        h('button', { class: 'btn sm danger', onclick: async () => { if (await confirmDialog('Delete', 'Delete this announcement?', { danger: true, label: 'Delete' })) { try { await api('DELETE', `/announcements/${a.id}`); load() } catch (e) { fail(e) } } } }, 'Delete')) : null },
    ], items, { empty: 'No announcements.' }))
  }
  function edit(a) {
    formModal({ title: a ? 'Edit announcement' : 'New announcement', wide: true, fields, initial: a ?? { type: 'info', dismissible: true, enabled: true },
      onSubmit: async (v) => {
        const body = { ...v, dismissible: !!v.dismissible, enabled: !!v.enabled, targeting: v.targeting ?? {} }
        if (a) await api('PUT', `/announcements/${a.id}`, body)
        else await api('POST', '/announcements', body)
        toast('Saved', 'ok')
        load()
      } })
  }
  root.append(pageHead('Announcements', 'Banners shown at the top of the launcher: info, success, warning, critical.', w ? h('button', { class: 'btn primary', onclick: () => edit() }, '+ New announcement') : null), holder)
  await load()
}
