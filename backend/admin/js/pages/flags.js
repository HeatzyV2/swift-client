import { api } from '../api.js'
import { formModal } from '../form.js'
import { badge, clear, confirmDialog, fail, h, jsonView, pageHead, table, tabs, toast } from '../ui.js'

export default async function render(root, { can }) {
  const w = can('config.write')
  let tab = 'flags'
  const head = h('div', null)
  const body = h('div', null)
  root.append(head, body)

  function drawHead() {
    clear(head).append(pageHead('Flags & remote config', 'Switch launcher features on/off and tune values without a release. Data only: nothing here is ever executed.',
      w ? h('button', { class: 'btn primary', onclick: () => (tab === 'flags' ? editFlag() : editCfg()) }, tab === 'flags' ? '+ New flag' : '+ New value') : null),
    tabs([['flags', 'Feature flags & A/B tests'], ['config', 'Remote config']], tab, (t) => { tab = t; drawHead(); drawBody() }))
  }

  async function drawBody() {
    clear(body)
    if (tab === 'flags') {
      const flags = await api('GET', '/flags')
      body.append(table([
        { label: 'Flag', render: f => h('div', null, h('b', { class: 'mono' }, f.key), h('div', { class: 'faint' }, f.description ?? '')) },
        { label: 'State', render: f => f.enabled ? badge('on', 'ok') : badge('off') },
        { label: 'Audience', render: f => Object.keys(f.targeting).length ? badge('targeted', 'blue') : 'Everyone' },
        { label: 'A/B', render: f => f.variants.length ? f.variants.map(v => badge(`${v.key} ${v.weight}%`)) : '–' },
        { label: '', class: 'actions-cell', render: f => w ? h('div', { class: 'flex', style: { justifyContent: 'flex-end' } },
          h('button', { class: 'btn sm', onclick: () => toggle(f) }, f.enabled ? 'Turn off' : 'Turn on'),
          h('button', { class: 'btn sm', onclick: () => editFlag(f) }, 'Edit'),
          h('button', { class: 'btn sm danger', onclick: async () => { if (await confirmDialog('Delete flag', `Delete ${f.key}? Launchers will see it as off.`, { danger: true, label: 'Delete' })) { try { await api('DELETE', `/flags/${f.key}`); drawBody() } catch (e) { fail(e) } } } }, 'Delete')) : null },
      ], flags, { empty: 'No flags yet.' }))
    } else {
      const cfg = await api('GET', '/remote-config')
      body.append(table([
        { label: 'Key', render: c => h('div', null, h('b', { class: 'mono' }, c.key), h('div', { class: 'faint' }, c.description ?? '')) },
        { label: 'Value', render: c => h('span', { class: 'mono' }, JSON.stringify(c.value).slice(0, 90)) },
        { label: '', class: 'actions-cell', render: c => w ? h('div', { class: 'flex', style: { justifyContent: 'flex-end' } }, h('button', { class: 'btn sm', onclick: () => editCfg(c) }, 'Edit'),
          h('button', { class: 'btn sm danger', onclick: async () => { if (await confirmDialog('Delete value', `Delete ${c.key}?`, { danger: true, label: 'Delete' })) { try { await api('DELETE', `/remote-config/${c.key}`); drawBody() } catch (e) { fail(e) } } } }, 'Delete')) : null },
      ], cfg, { empty: 'No remote config values yet.' }))
    }
  }

  async function toggle(f) {
    try { await api('PUT', `/flags/${f.key}`, { description: f.description, enabled: !f.enabled, targeting: f.targeting, variants: f.variants }); drawBody() } catch (e) { fail(e) }
  }

  function editFlag(f) {
    formModal({ title: f ? `Edit ${f.key}` : 'New flag', wide: true,
      fields: [
        ...(f ? [] : [{ key: 'key', label: 'Key', required: true, placeholder: 'new-home-layout', hint: 'lowercase letters, numbers, dot, dash, underscore' }]),
        { key: 'description', label: 'Description', nullable: true, max: 200 },
        { key: 'enabled', label: 'Enabled', type: 'bool' },
        { key: 'variants', label: 'A/B variants (JSON: [{"key":"a","weight":50}])', type: 'json', rows: 3, hint: 'Weights are % of the targeted audience; everyone else gets "control". Leave [] for a plain flag.' },
        { key: 'targeting', type: 'targeting' },
      ],
      initial: f ?? { enabled: false, variants: [] },
      onSubmit: async (v) => {
        const key = f?.key ?? v.key
        await api('PUT', `/flags/${encodeURIComponent(key)}`, { description: v.description ?? null, enabled: !!v.enabled, targeting: v.targeting ?? {}, variants: v.variants ?? [] })
        toast('Flag saved', 'ok')
        drawBody()
      } })
  }

  function editCfg(c) {
    formModal({ title: c ? `Edit ${c.key}` : 'New value', wide: true,
      fields: [
        ...(c ? [] : [{ key: 'key', label: 'Key', required: true, placeholder: 'ui.maxDownloads' }]),
        { key: 'description', label: 'Description', nullable: true, max: 200 },
        { key: 'value', label: 'Value (JSON: string, number, boolean, list or object)', type: 'json', required: true, rows: 6 },
      ],
      initial: c ?? { value: '' },
      onSubmit: async (v) => {
        await api('PUT', `/remote-config/${encodeURIComponent(c?.key ?? v.key)}`, { value: v.value, description: v.description ?? null })
        toast('Saved', 'ok')
        drawBody()
      } })
  }

  drawHead()
  await drawBody()
}
