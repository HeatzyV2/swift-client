import { api } from '../api.js'
import { formModal } from '../form.js'
import { confirmDialog, fail, fmtDate, h, modal, num, pageHead, statusBadge, table, toast, clear } from '../ui.js'

const fields = [
  { key: 'name', label: 'Partner name', required: true, max: 80 },
  { key: 'status', label: 'Status', type: 'select', options: [['active', 'Active'], ['paused', 'Paused (campaigns stop)'], ['ended', 'Ended']] },
  { key: 'contact', label: 'Contact', nullable: true, max: 200, placeholder: 'name@example.com / Discord' },
  { key: 'website', label: 'Website', type: 'url', nullable: true },
  { key: 'notes', label: 'Internal notes', type: 'textarea', nullable: true, max: 2000 },
]

export default async function render(root, { can }) {
  const w = can('partners.write')
  const holder = h('div', null)
  async function load() {
    const items = await api('GET', '/partners')
    clear(holder).append(table([
      { label: 'Partner', render: p => h('div', null, h('b', null, p.name), h('div', { class: 'faint' }, p.contact ?? '')) },
      { label: 'Status', render: p => statusBadge(p.status) },
      { label: 'Added', render: p => fmtDate(p.createdAt) },
      { label: '', class: 'actions-cell', render: p => h('div', { class: 'flex', style: { justifyContent: 'flex-end' } },
        h('button', { class: 'btn sm', onclick: () => stats(p) }, 'Stats'),
        w ? h('button', { class: 'btn sm', onclick: () => edit(p) }, 'Edit') : null,
        w ? h('button', { class: 'btn sm danger', onclick: async () => { if (await confirmDialog('Delete partner', `Delete ${p.name}?`, { danger: true, label: 'Delete' })) { try { await api('DELETE', `/partners/${p.id}`); load() } catch (e) { fail(e) } } } }, 'Delete') : null) },
    ], items, { empty: 'No partners yet.' }))
  }
  function edit(p) {
    formModal({ title: p ? `Edit ${p.name}` : 'New partner', fields, initial: p ?? { status: 'active' },
      onSubmit: async (v) => { if (p) await api('PUT', `/partners/${p.id}`, v); else await api('POST', '/partners', v); toast('Saved', 'ok'); load() } })
  }
  async function stats(p) {
    const s = await api('GET', `/partners/${p.id}/stats?days=30`)
    const t = s.totals
    modal({ title: `${p.name} · last 30 days`, body: h('div', { class: 'grid g4' },
      ...[['Impressions', num(t.impressions)], ['Clicks', num(t.clicks)], ['CTR', `${t.ctr}%`], ['Play attempts', num(t.playAttempts)], ['Launches', num(t.launches)], ['Launch rate', `${t.launchRate}%`]]
        .map(([l, v]) => h('div', { class: 'card stat' }, h('div', { class: 'v' }, v), h('div', { class: 'l' }, l)))), actions: [{ label: 'Close' }] })
  }
  root.append(pageHead('Partners', 'Server owners and sponsors. Campaigns hang off a partner.', w ? h('button', { class: 'btn primary', onclick: () => edit() }, '+ New partner') : null), holder)
  await load()
}
