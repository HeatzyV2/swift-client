import { api } from '../api.js'
import { clear, h, num, pageHead } from '../ui.js'

const EVENTS = ['app_open', 'launch_game', 'launch_success', 'launch_fail', 'home_view', 'news_open', 'update_applied']

function bars(rows) {
  const max = Math.max(1, ...rows.map(r => r.devices))
  return h('div', { class: 'grid' }, rows.length ? rows.map(r => h('div', null, h('div', { class: 'flex between' }, h('span', null, r.key), h('span', { class: 'muted' }, num(r.devices))), h('div', { class: 'bar' }, h('i', { style: { width: `${r.devices / max * 100}%` } })))) : [h('div', { class: 'faint' }, 'No data yet')])
}

export default async function render(root) {
  const body = h('div', null)
  const days = h('select', { onchange: load }, [7, 14, 30, 90].map(d => h('option', { value: d, selected: d === 30 }, `Last ${d} days`)))
  root.append(pageHead('Analytics', 'Aggregated, pseudonymous launcher usage. No IP address or account id is stored.', days), body)

  async function load() {
    const o = await api('GET', `/analytics/overview?days=${days.value}`)
    clear(body).append(
      h('div', { class: 'grid g4' }, h('div', { class: 'card stat' }, h('div', { class: 'v' }, num(o.activeDevices)), h('div', { class: 'l' }, 'Active devices')),
        ...['app_open', 'launch_game', 'launch_fail'].map(k => h('div', { class: 'card stat' }, h('div', { class: 'v' }, num(o.totals[k] ?? 0)), h('div', { class: 'l' }, k.replace(/_/g, ' '))))),
      h('div', { class: 'sp' }),
      h('div', { class: 'grid g2' }, EVENTS.slice(0, 4).map(k => {
        const vals = o.daily.map(d => d[k] ?? 0)
        const max = Math.max(1, ...vals)
        return h('div', { class: 'card' }, h('h3', null, k.replace(/_/g, ' ')), h('div', { class: 'spark' }, o.daily.length ? o.daily.map((d, i) => h('i', { style: { height: `${Math.max(3, vals[i] / max * 100)}%` }, title: `${d.day}: ${vals[i]}` })) : [h('span', { class: 'faint' }, 'No data yet')]))
      })),
      h('div', { class: 'sp' }),
      h('div', { class: 'grid g3' },
        h('div', { class: 'card' }, h('h3', null, 'Launcher versions'), bars(o.launcherVersions)),
        h('div', { class: 'card' }, h('h3', null, 'Minecraft versions'), bars(o.minecraftVersions)),
        h('div', { class: 'card' }, h('h3', null, 'Operating systems'), bars(o.os)),
        h('div', { class: 'card' }, h('h3', null, 'Architectures'), bars(o.arch)),
        h('div', { class: 'card' }, h('h3', null, 'Languages'), bars(o.locales))),
      h('p', { class: 'faint' }, `Raw events are kept ${o.retentionDays} days; daily counters are kept longer.`))
  }
  await load()
}
