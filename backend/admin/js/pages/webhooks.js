import { api, apiFull, qs } from '../api.js'
import { formModal } from '../form.js'
import { badge, clear, confirmDialog, fail, fmtDate, h, modal, pageHead, statusBadge, table, toast } from '../ui.js'

export default async function render(root) {
  const holder = h('div', null)
  let eventNames = []

  async function load() {
    const d = await api('GET', '/webhooks')
    eventNames = d.events
    clear(holder).append(table([
      { label: 'Webhook', render: x => h('div', null, h('b', null, x.name), h('div', { class: 'faint mono' }, x.url.length > 56 ? `${x.url.slice(0, 56)}…` : x.url)) },
      { label: 'Type', render: x => badge(x.kind, x.kind === 'discord' ? 'blue' : '') },
      { label: 'Events', render: x => h('div', { class: 'flex', style: { flexWrap: 'wrap' } }, x.events.slice(0, 3).map(e => badge(e)), x.events.length > 3 ? badge(`+${x.events.length - 3}`) : null) },
      { label: 'State', render: x => x.enabled ? badge('on', 'ok') : badge('off') },
      { label: 'Secret', render: x => h('span', { class: 'mono faint' }, x.secretHint) },
      { label: '', class: 'actions-cell', render: x => h('div', { class: 'flex', style: { justifyContent: 'flex-end' } },
        h('button', { class: 'btn sm', onclick: () => deliveries(x) }, 'Deliveries'),
        h('button', { class: 'btn sm', onclick: async () => { try { await api('POST', `/webhooks/${x.id}/test`); toast('Test ping queued', 'ok') } catch (e) { fail(e) } } }, 'Test'),
        h('button', { class: 'btn sm', onclick: () => edit(x) }, 'Edit'),
        h('button', { class: 'btn sm danger', onclick: async () => { if (await confirmDialog('Delete webhook', `Delete ${x.name} and its delivery log?`, { danger: true, label: 'Delete' })) { try { await api('DELETE', `/webhooks/${x.id}`); load() } catch (e) { fail(e) } } } }, 'Delete')) },
    ], d.items, { empty: 'No webhooks yet.' }))
  }

  function showSecret(secret) {
    modal({ title: 'Signing secret', body: h('div', null, h('p', { class: 'muted' }, 'Copy it now: it will not be shown again. Each delivery carries X-Swift-Signature: t=<unix>,v1=HMAC_SHA256(secret, "<t>.<body>").'), h('input', { type: 'text', value: secret, readonly: true, onclick: (e) => e.target.select(), class: 'mono' })), actions: [{ label: 'Done', kind: 'primary' }] })
  }

  function edit(x) {
    formModal({ title: x ? `Edit ${x.name}` : 'New webhook', wide: true,
      fields: [
        { key: 'name', label: 'Name', required: true, max: 60 },
        { key: 'kind', label: 'Format', type: 'select', options: [['generic', 'Generic JSON (signed)'], ['discord', 'Discord channel webhook']] },
        { key: 'url', label: 'URL', type: 'url', required: true, placeholder: 'https://…' },
        { key: 'events', label: 'Events', type: 'multi', options: ['*', ...eventNames], required: true, hint: '* = every event' },
        { key: 'enabled', label: 'Enabled', type: 'bool', default: true },
      ], initial: x ?? { kind: 'generic', enabled: true, events: [] },
      onSubmit: async (v) => {
        const body = { ...v, enabled: !!v.enabled }
        if (x) await api('PUT', `/webhooks/${x.id}`, body)
        else { const created = await api('POST', '/webhooks', body); setTimeout(() => showSecret(created.secret), 50) }
        toast('Webhook saved', 'ok')
        load()
      } })
  }

  async function deliveries(x) {
    const body = h('div', null)
    const draw = async (page = 1) => {
      const { data, meta } = await apiFull('GET', `/webhooks/${x.id}/deliveries${qs({ page, limit: 15 })}`)
      clear(body).append(table([
        { label: 'When', render: d => fmtDate(d.createdAt) }, { label: 'Event', key: 'event' }, { label: 'Status', render: d => statusBadge(d.status) },
        { label: 'Attempts', key: 'attempts' }, { label: 'HTTP', render: d => d.lastStatus ?? '–' }, { label: 'Error', render: d => h('span', { class: 'faint' }, d.lastError ?? '') },
        { label: '', render: d => d.status === 'failed' ? h('button', { class: 'btn sm', onclick: async () => { try { await api('POST', `/webhook-deliveries/${d.id}/retry`); draw(page) } catch (e) { fail(e) } } }, 'Retry') : null },
      ], data, { empty: 'No deliveries yet.' }), h('div', { class: 'pager' }, `page ${meta.page}/${meta.pages}`, h('button', { class: 'btn sm', disabled: page <= 1, onclick: () => draw(page - 1) }, '‹'), h('button', { class: 'btn sm', disabled: page >= meta.pages, onclick: () => draw(page + 1) }, '›')))
    }
    modal({ title: `Deliveries · ${x.name}`, wide: true, body, actions: [{ label: 'Close' }] })
    draw()
  }

  root.append(pageHead('Webhooks', 'Push platform events (releases, news, maintenance…) to your tools. Signed, retried with backoff, fully logged. Discord format supported.', h('button', { class: 'btn primary', onclick: () => edit() }, '+ New webhook')), holder)
  await load()
}
