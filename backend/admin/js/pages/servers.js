import { api } from '../api.js'
import { formModal } from '../form.js'
import { badge, confirmDialog, fail, h, pageHead, table, toast } from '../ui.js'
import { paginated } from './_kit.js'

const fields = [
  { key: 'name', label: 'Name', required: true, max: 60 },
  { key: 'edition', label: 'Edition', type: 'select', options: [['java', 'Java'], ['bedrock', 'Bedrock'], ['crossplay', 'Crossplay (Java + Bedrock)']] },
  { key: 'address', label: 'Address', required: true, placeholder: 'play.example.com', hint: 'Hostname or IP, without scheme or port.' },
  { key: 'port', label: 'Java port', type: 'number', min: 1, max: 65535, default: 25565 },
  { key: 'bedrockAddress', label: 'Bedrock address', nullable: true, hint: 'Only when different from the Java address.' },
  { key: 'bedrockPort', label: 'Bedrock port', type: 'number', min: 1, max: 65535, nullable: true },
  { key: 'minVersion', label: 'Minimum Minecraft version', nullable: true, placeholder: '1.20.1' },
  { key: 'maxVersion', label: 'Maximum Minecraft version', nullable: true, placeholder: '1.21.4' },
  { key: 'description', label: 'Description', type: 'localized', multiline: true, max: 400 },
  { key: 'icon', label: 'Icon', type: 'image', nullable: true },
  { key: 'banner', label: 'Banner', type: 'image', nullable: true },
  { key: 'website', label: 'Website', type: 'url', nullable: true },
  { key: 'tags', label: 'Tags', type: 'tags', placeholder: 'survival, pvp, minigames' },
  { key: 'featured', label: 'Featured (shown on the launcher home)', type: 'bool' },
  { key: 'verified', label: 'Verified by Swift', type: 'bool' },
  { key: 'ingame', label: 'Show in the in-game server list (mod)', type: 'bool' },
  { key: 'enabled', label: 'Enabled', type: 'bool', default: true },
  { key: 'position', label: 'Order', type: 'number', min: 0, max: 9999, default: 0 },
]

export default async function render(root, { can }) {
  const w = can('servers.write')
  let reload = async () => {}
  function edit(s) {
    formModal({ title: s ? `Edit ${s.name}` : 'New server', wide: true, fields,
      initial: s ? { ...s, bedrockAddress: s.bedrock?.address, bedrockPort: s.bedrock?.port } : { edition: 'java', port: 25565, enabled: true, position: 0 },
      onSubmit: async (v) => {
        const body = { ...v, featured: !!v.featured, verified: !!v.verified, ingame: !!v.ingame, enabled: !!v.enabled, port: v.port ?? 25565, position: v.position ?? 0 }
        if (s) await api('PUT', `/servers/${s.id}`, body)
        else await api('POST', '/servers', body)
        toast('Server saved', 'ok')
        reload()
      } })
  }
  root.append(pageHead('Servers', 'Servers shown in the launcher and, when flagged, in the game.', w ? h('button', { class: 'btn primary', onclick: () => edit() }, '+ New server') : null))
  const r = await paginated(root, {
    endpoint: '/servers', filters: [{ key: 'edition', label: 'All editions', options: ['java', 'bedrock', 'crossplay'] }],
    build: (items) => table([
      { label: 'Server', render: s => h('div', { class: 'flex' }, s.iconUrl ? h('img', { src: s.iconUrl, width: 32, height: 32, alt: '', style: { borderRadius: '8px' } }) : null, h('div', null, h('b', null, s.name), h('div', { class: 'faint mono' }, `${s.address}:${s.port}`))) },
      { label: 'Edition', render: s => badge(s.edition, 'blue') },
      { label: 'Versions', render: s => (s.minVersion || s.maxVersion) ? `${s.minVersion ?? '…'} – ${s.maxVersion ?? '…'}` : 'Any' },
      { label: 'Flags', render: s => h('div', { class: 'flex', style: { flexWrap: 'wrap' } }, s.featured ? badge('featured', 'blue') : null, s.verified ? badge('verified', 'ok') : null, s.ingame ? badge('in-game') : null, !s.enabled ? badge('disabled', 'bad') : null) },
      { label: '', class: 'actions-cell', render: s => w ? h('div', { class: 'flex', style: { justifyContent: 'flex-end' } }, h('button', { class: 'btn sm', onclick: () => edit(s) }, 'Edit'),
        h('button', { class: 'btn sm danger', onclick: async () => { if (await confirmDialog('Delete server', `Delete ${s.name}? Its campaigns stay but lose the link.`, { danger: true, label: 'Delete' })) { try { await api('DELETE', `/servers/${s.id}`); reload() } catch (e) { fail(e) } } } }, 'Delete')) : null },
    ], items, { empty: 'No servers yet.' }),
  })
  reload = r.reload
}
