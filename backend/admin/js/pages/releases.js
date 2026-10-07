import { api } from '../api.js'
import { formModal } from '../form.js'
import { badge, confirmDialog, fail, fmtDate, h, modal, pageHead, statusBadge, table, toast } from '../ui.js'
import { paginated } from './_kit.js'

const fields = [
  { key: 'version', label: 'Version', required: true, placeholder: '1.4.0 or 1.5.0-beta.1' },
  { key: 'channel', label: 'Channel', type: 'select', options: [['stable', 'Stable'], ['beta', 'Beta'], ['canary', 'Canary'], ['development', 'Development']] },
  { key: 'platform', label: 'Platform', type: 'select', options: [['windows', 'Windows'], ['macos', 'macOS'], ['linux', 'Linux']] },
  { key: 'arch', label: 'Architecture', type: 'select', options: [['x64', 'x64'], ['arm64', 'arm64'], ['x86', 'x86']] },
  { key: 'url', label: 'Download URL (https)', type: 'url', required: true, placeholder: 'https://download.swiftclient.fr/…' },
  { key: 'sha256', label: 'SHA-256 checksum', required: true, placeholder: '64 hex characters' },
  { key: 'signature', label: 'Updater signature', type: 'textarea', nullable: true, rows: 3, hint: 'Content of the .sig file; required for the in-app updater.' },
  { key: 'size', label: 'Size in bytes', type: 'number', min: 1, nullable: true },
  { key: 'notes', label: 'Release notes', type: 'localized', multiline: true, max: 4000 },
  { key: 'mandatory', label: 'Mandatory update', type: 'bool' },
  { key: 'minimumVersion', label: 'Minimum supported version', nullable: true, hint: 'Clients below this are forced to update.' },
  { key: 'rolloutPercent', label: 'Rollout %', type: 'number', min: 1, max: 100, default: 100, hint: 'Staged rollout, stable per device.' },
]

export default async function render(root, { can }) {
  const w = can('releases.write')
  const pub = can('releases.publish')
  let reload = async () => {}

  function edit(r) {
    formModal({ title: r ? `Edit ${r.version}` : 'New release (draft)', wide: true, fields, initial: r ?? { channel: 'stable', platform: 'windows', arch: 'x64', rolloutPercent: 100 },
      onSubmit: async (v) => {
        const body = { ...v, mandatory: !!v.mandatory, rolloutPercent: v.rolloutPercent ?? 100 }
        if (r) await api('PUT', `/releases/${r.id}`, body)
        else await api('POST', '/releases', body)
        toast('Release saved', 'ok')
        reload()
      } })
  }

  async function publish(r) {
    if (!(await confirmDialog('Publish release', `Publish ${r.version} on ${r.channel} for ${r.platform}/${r.arch}? Matching launchers will be offered the update${r.mandatory ? ' (mandatory)' : ''}.`, { label: 'Publish' }))) return
    try { await api('POST', `/releases/${r.id}/publish`); toast('Published', 'ok'); reload() } catch (e) { fail(e) }
  }

  function revoke(r) {
    const reason = h('input', { type: 'text', placeholder: 'Why is it being withdrawn?', maxlength: 300 })
    modal({ title: `Roll back ${r.version}`, body: h('div', null, h('p', { class: 'muted' }, 'Launchers will stop being offered this version and get the previous published one instead.'), h('div', { class: 'field' }, h('label', null, 'Reason'), reason)),
      actions: [{ label: 'Cancel' }, { label: 'Revoke release', kind: 'danger', run: async () => { await api('POST', `/releases/${r.id}/revoke`, { reason: reason.value.trim() }); toast('Release revoked', 'ok'); reload() } }] })
  }

  root.append(pageHead('Releases', 'Launcher versions per channel, platform and architecture. Publishing makes launchers offer the update; revoking rolls back.', w ? h('button', { class: 'btn primary', onclick: () => edit() }, '+ New release') : null))
  const r = await paginated(root, {
    endpoint: '/releases', search: false,
    filters: [{ key: 'channel', label: 'All channels', options: ['stable', 'beta', 'canary', 'development'] }, { key: 'status', label: 'All statuses', options: ['draft', 'published', 'revoked'] }],
    build: (items) => table([
      { label: 'Version', render: x => h('div', null, h('b', { class: 'mono' }, x.version), h('div', { class: 'faint' }, x.mandatory ? 'mandatory' : '', x.minimumVersion ? ` · min ${x.minimumVersion}` : '')) },
      { label: 'Channel', render: x => badge(x.channel, 'blue') },
      { label: 'Target', render: x => `${x.platform}/${x.arch}` },
      { label: 'Rollout', render: x => `${x.rolloutPercent}%` },
      { label: 'Status', render: x => h('div', null, statusBadge(x.status), x.revokeReason ? h('div', { class: 'faint' }, x.revokeReason) : null) },
      { label: 'Published', render: x => fmtDate(x.publishedAt) },
      { label: '', class: 'actions-cell', render: x => h('div', { class: 'flex', style: { justifyContent: 'flex-end' } },
        w && x.status === 'draft' ? h('button', { class: 'btn sm', onclick: () => edit(x) }, 'Edit') : null,
        pub && x.status !== 'published' ? h('button', { class: 'btn sm primary', onclick: () => publish(x) }, 'Publish') : null,
        pub && x.status === 'published' ? h('button', { class: 'btn sm danger', onclick: () => revoke(x) }, 'Roll back') : null,
        w && x.status !== 'published' ? h('button', { class: 'btn sm danger', onclick: async () => { if (await confirmDialog('Delete release', `Delete ${x.version}?`, { danger: true, label: 'Delete' })) { try { await api('DELETE', `/releases/${x.id}`); reload() } catch (e) { fail(e) } } } }, 'Delete') : null) },
    ], items, { empty: 'No releases registered.' }),
  })
  reload = r.reload
}
