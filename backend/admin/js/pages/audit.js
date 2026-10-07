import { api } from '../api.js'
import { badge, fail, fmtDate, h, jsonView, modal, pageHead, table } from '../ui.js'
import { paginated } from './_kit.js'

async function open(row) {
  try {
    const d = await api('GET', `/audit-logs/${row.id}`)
    modal({ title: d.action, wide: true, body: h('div', null,
      h('div', { class: 'faint', style: { marginBottom: '10px' } }, `${fmtDate(d.at)} · ${d.actorName ?? 'system'} · ${d.ip ?? 'no ip'} · request ${d.requestId ?? '–'}`),
      d.summary ? h('p', null, d.summary) : null,
      h('div', { class: 'grid g2' }, h('div', { class: 'card' }, h('h3', null, 'Before'), d.before ? jsonView(d.before) : h('span', { class: 'faint' }, 'n/a')), h('div', { class: 'card' }, h('h3', null, 'After'), d.after ? jsonView(d.after) : h('span', { class: 'faint' }, 'n/a')))),
    actions: [{ label: 'Close' }] })
  } catch (e) { fail(e) }
}

export default async function render(root) {
  root.append(pageHead('Audit log', 'Every administrative action: who, what, when, from where, with before/after state. Secrets are redacted.'))
  await paginated(root, {
    endpoint: '/audit-logs', limit: 40,
    build: (items) => table([
      { label: 'When', render: a => fmtDate(a.at) },
      { label: 'Who', render: a => a.actorName ?? h('span', { class: 'faint' }, 'system') },
      { label: 'Action', render: a => badge(a.action, a.action.includes('delete') || a.action.includes('revoke') || a.action.includes('failed') ? 'bad' : a.action.includes('publish') ? 'ok' : 'blue') },
      { label: 'Summary', render: a => a.summary ?? '–' },
      { label: 'IP', render: a => h('span', { class: 'mono faint' }, a.ip ?? '–') },
      { label: '', class: 'actions-cell', render: a => h('button', { class: 'btn sm', onclick: () => open(a) }, 'Details') },
    ], items, { empty: 'No audit entries.' }),
  })
}
