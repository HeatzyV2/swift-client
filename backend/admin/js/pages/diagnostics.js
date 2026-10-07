import { api } from '../api.js'
import { badge, fail, fmtDate, h, jsonView, modal, num, pageHead, statusBadge, table, toast } from '../ui.js'
import { paginated } from './_kit.js'

const CATEGORIES = ['launcher_crash', 'game_crash', 'java_missing', 'java_incompatible', 'modloader_install_failed', 'auth_failed', 'network_error', 'download_failed', 'update_failed', 'disk_space', 'other']

export default async function render(root, { can }) {
  const w = can('diagnostics.write')
  let reload = async () => {}

  async function open(g) {
    const d = await api('GET', `/diagnostics/groups/${g.fingerprint}`)
    const setStatus = async (status) => { try { await api('POST', `/diagnostics/groups/${g.fingerprint}/status`, { status }); toast('Updated', 'ok'); reload() } catch (e) { fail(e) } }
    modal({ title: d.group.title || d.group.category, wide: true,
      body: h('div', null,
        h('div', { class: 'flex', style: { marginBottom: '12px', flexWrap: 'wrap' } }, badge(d.group.category.replace(/_/g, ' '), 'blue'), statusBadge(d.group.status), badge(`${num(d.group.occurrences)} reports`), h('span', { class: 'faint' }, `first ${fmtDate(d.group.firstSeen)} · last ${fmtDate(d.group.lastSeen)}`)),
        h('div', { class: 'grid g2' },
          h('div', { class: 'card' }, h('h3', null, 'By launcher version'), table([{ label: 'Version', key: 'key' }, { label: 'Reports', key: 'count' }], d.byLauncherVersion, { empty: 'n/a' })),
          h('div', { class: 'card' }, h('h3', null, 'By OS'), table([{ label: 'OS', key: 'key' }, { label: 'Reports', key: 'count' }], d.byOs, { empty: 'n/a' }))),
        h('div', { class: 'sp' }), h('h3', { class: 'muted' }, 'Latest reports (scrubbed)'),
        table([{ label: 'When', render: r => fmtDate(r.at) }, { label: 'Launcher', key: 'launcherVersion' }, { label: 'MC', key: 'mcVersion' }, { label: 'OS', render: r => `${r.os ?? '–'}/${r.arch ?? '–'}` },
          { label: 'Message', render: r => h('span', { class: 'mono' }, (r.message ?? '').slice(0, 140)) }], d.reports, { empty: 'No reports.' })),
      actions: [{ label: 'Close' }, ...(w ? [{ label: 'Ignore', run: () => setStatus('ignored') }, { label: d.group.status === 'resolved' ? 'Reopen' : 'Mark resolved', kind: 'primary', run: () => setStatus(d.group.status === 'resolved' ? 'open' : 'resolved') }] : [])] })
  }

  root.append(pageHead('Diagnostics', 'Error reports from launchers, grouped by fingerprint. Paths, emails and tokens are scrubbed on arrival.'))
  const r = await paginated(root, {
    endpoint: '/diagnostics/groups', search: false,
    filters: [{ key: 'category', label: 'All categories', options: CATEGORIES }, { key: 'status', label: 'All statuses', options: ['open', 'resolved', 'ignored'] }],
    build: (items) => table([
      { label: 'Issue', render: g => h('div', null, h('b', null, g.title || g.category), h('div', { class: 'faint mono' }, g.fingerprint)) },
      { label: 'Category', render: g => badge(g.category.replace(/_/g, ' '), 'blue') },
      { label: 'Reports', render: g => num(g.occurrences) },
      { label: 'Last seen', render: g => fmtDate(g.lastSeen) },
      { label: 'Status', render: g => statusBadge(g.status) },
      { label: '', class: 'actions-cell', render: g => h('button', { class: 'btn sm', onclick: () => open(g) }, 'Open') },
    ], items, { empty: 'No error reports. 🎉' }),
  })
  reload = r.reload
}
