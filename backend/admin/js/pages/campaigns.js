import { api } from '../api.js'
import { formModal } from '../form.js'
import { badge, clear, confirmDialog, fail, first, fmtDate, h, modal, num, pageHead, table, toast } from '../ui.js'

const PLACEMENTS = [['home_banner', 'Launcher home banner'], ['ingame_slot', 'In-game server slot (mod)'], ['server_list', 'Launcher server list'], ['announcement', 'Announcement']]

function sparkline(daily, key) {
  const vals = daily.map(d => d[key] ?? 0)
  const max = Math.max(1, ...vals)
  return h('div', { class: 'spark' }, daily.length ? daily.map((d, i) => h('i', { style: { height: `${Math.max(3, vals[i] / max * 100)}%` }, title: `${d.day}: ${vals[i]}` })) : [h('span', { class: 'faint' }, 'No data yet')])
}

export default async function render(root, { can }) {
  const w = can('partners.write')
  const holder = h('div', null)
  let partners = []
  let servers = []

  async function load() {
    const [items, p, s] = await Promise.all([api('GET', '/campaigns'), api('GET', '/partners'), api('GET', '/servers?limit=100')])
    partners = p
    servers = s
    const now = Date.now()
    const state = (c) => !c.enabled ? badge('off') : (c.startsAt && Date.parse(c.startsAt) > now) ? badge('scheduled', 'blue') : (c.endsAt && Date.parse(c.endsAt) <= now) ? badge('ended') : badge('live', 'ok')
    clear(holder).append(table([
      { label: 'Campaign', render: c => h('div', null, h('b', null, c.name), h('div', { class: 'faint' }, partners.find(x => x.id === c.partnerId)?.name ?? 'No partner')) },
      { label: 'Placement', render: c => badge(PLACEMENTS.find(p => p[0] === c.placement)?.[1] ?? c.placement, 'blue') },
      { label: 'State', render: c => state(c) },
      { label: 'Window', render: c => (c.startsAt || c.endsAt) ? `${c.startsAt ? fmtDate(c.startsAt) : '…'} → ${c.endsAt ? fmtDate(c.endsAt) : '…'}` : 'Always' },
      { label: 'Prio', key: 'priority' },
      { label: '', class: 'actions-cell', render: c => h('div', { class: 'flex', style: { justifyContent: 'flex-end' } },
        h('button', { class: 'btn sm', onclick: () => stats(c) }, 'Stats'),
        w ? h('button', { class: 'btn sm', onclick: () => edit(c) }, 'Edit') : null,
        w ? h('button', { class: 'btn sm danger', onclick: async () => { if (await confirmDialog('Delete campaign', `Delete ${c.name} and its statistics?`, { danger: true, label: 'Delete' })) { try { await api('DELETE', `/campaigns/${c.id}`); load() } catch (e) { fail(e) } } } }, 'Delete') : null) },
    ], items, { empty: 'No campaigns yet.' }))
  }

  function edit(c) {
    formModal({
      title: c ? `Edit ${c.name}` : 'New campaign', wide: true,
      fields: [
        { key: 'name', label: 'Name', required: true, max: 80 },
        { key: 'placement', label: 'Placement', type: 'select', options: PLACEMENTS },
        { key: 'partnerId', label: 'Partner', type: 'select', options: [['', '— none —'], ...partners.map(p => [p.id, p.name])], nullable: true },
        { key: 'serverId', label: 'Server', type: 'select', options: [['', '— none —'], ...servers.map(s => [s.id, s.name])], nullable: true, hint: 'Required for in-game slots.' },
        { key: 'h1', label: 'Creative', type: 'heading' },
        { key: 'title', label: 'Title', type: 'localized', max: 80 },
        { key: 'subtitle', label: 'Subtitle', type: 'localized', max: 160 },
        { key: 'image', label: 'Image', type: 'image', nullable: true },
        { key: 'ctaLabel', label: 'Button label', type: 'localized', max: 40 },
        { key: 'ctaUrl', label: 'Button link', type: 'url', nullable: true },
        { key: 'h2', label: 'Delivery', type: 'heading' },
        { key: 'priority', label: 'Priority (higher first)', type: 'number', min: 0, max: 1000, default: 0 },
        { key: 'enabled', label: 'Enabled', type: 'bool', default: true },
        { key: 'startsAt', label: 'Starts at', type: 'datetime', nullable: true },
        { key: 'endsAt', label: 'Ends at', type: 'datetime', nullable: true },
        { key: 'targeting', type: 'targeting' },
      ],
      initial: c ? { ...c, ...c.creative, ctaLabel: c.creative.cta?.label, ctaUrl: c.creative.cta?.url } : { placement: 'home_banner', enabled: true, priority: 0 },
      onSubmit: async (v) => {
        if (v.placement === 'ingame_slot' && !v.serverId) throw new Error('Choose the server to show in the game')
        const creative = { title: v.title ?? {}, subtitle: v.subtitle ?? {}, image: v.image ?? null, cta: v.ctaUrl ? { label: v.ctaLabel ?? {}, url: v.ctaUrl } : null }
        const body = { name: v.name, placement: v.placement, partnerId: v.partnerId || null, serverId: v.serverId || null, creative, priority: v.priority ?? 0, enabled: !!v.enabled, startsAt: v.startsAt ?? null, endsAt: v.endsAt ?? null, targeting: v.targeting ?? {} }
        if (c) await api('PUT', `/campaigns/${c.id}`, body)
        else await api('POST', '/campaigns', body)
        toast('Campaign saved', 'ok')
        load()
      },
    })
  }

  async function stats(c) {
    const s = await api('GET', `/campaigns/${c.id}/stats?days=30`)
    const t = s.totals
    modal({ title: `${c.name} · last 30 days`, wide: true, body: h('div', null,
      h('div', { class: 'grid g4' }, ...[['Impressions', num(t.impressions)], ['Clicks', num(t.clicks)], ['CTR', `${t.ctr}%`], ['Play attempts', num(t.playAttempts)], ['Launches', num(t.launches)], ['Launch rate', `${t.launchRate}%`]]
        .map(([l, v]) => h('div', { class: 'card stat' }, h('div', { class: 'v' }, v), h('div', { class: 'l' }, l)))),
      h('div', { class: 'sp' }), h('div', { class: 'grid g2' }, h('div', { class: 'card' }, h('h3', null, 'Impressions per day'), sparkline(s.daily, 'impressions')), h('div', { class: 'card' }, h('h3', null, 'Clicks per day'), sparkline(s.daily, 'clicks')))),
    actions: [{ label: 'Close' }] })
  }

  root.append(pageHead('Campaigns', 'Where and when a partner or server is promoted, with targeting and live statistics.', w ? h('button', { class: 'btn primary', onclick: () => edit() }, '+ New campaign') : null), holder)
  await load()
}
