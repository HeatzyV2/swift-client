import { api } from '../api.js'
import { badge, h, num, pageHead, table, ago } from '../ui.js'

const stat = (label, value, detail) => h('div', { class: 'card stat' }, h('div', { class: 'v' }, value), h('div', { class: 'l' }, label), detail ? h('div', { class: 'd' }, detail) : null)

function spark(days, key) {
  const vals = days.map(d => d[key] ?? 0)
  const max = Math.max(1, ...vals)
  return h('div', { class: 'spark' }, days.map((d, i) => h('i', { style: { height: `${Math.max(2, vals[i] / max * 100)}%` }, title: `${d.day}: ${vals[i]}` })))
}

function bars(rows, label = 'key', value = 'devices') {
  const max = Math.max(1, ...rows.map(r => r[value]))
  return h('div', { class: 'grid' }, rows.length ? rows.map(r => h('div', null, h('div', { class: 'flex between' }, h('span', null, r[label]), h('span', { class: 'muted' }, num(r[value]))), h('div', { class: 'bar' }, h('i', { style: { width: `${r[value] / max * 100}%` } })))) : [h('div', { class: 'faint' }, 'No data yet')])
}

export default async function render(root, { user }) {
  const d = await api('GET', '/dashboard')
  root.append(pageHead(`Welcome back, ${user.username}`, `Swift Platform ${d.version} · ${d.environment} · updated ${ago(d.generatedAt)}`))
  if (d.maintenance) root.append(h('div', { class: 'banner' }, '⚒ Maintenance mode is ON: launchers are being told the service is down.'))
  root.append(h('div', { class: 'grid g4' },
    stat('Accounts', num(d.users.total), `${num(d.users.new7d)} new this week`),
    stat('Active (24h)', num(d.users.active24h), `${num(d.users.active7d)} in 7 days`),
    ...(d.analytics ? [stat('Active devices (14d)', num(d.analytics.activeDevices14d), 'pseudonymous, from launcher events'), stat('Game launches (14d)', num(d.analytics.totals.launch_game ?? 0), `${num(d.analytics.totals.launch_fail ?? 0)} failed`)] : []),
    ...(d.diagnostics ? [stat('Open issues', num(d.diagnostics.open), `${num(d.diagnostics.reports7d)} reports this week`)] : []),
    ...(d.content ? [stat('News published', num(d.content.newsPublished), `${d.content.newsDrafts} drafts · ${d.content.newsScheduled} scheduled`)] : []),
    ...(d.servers ? [stat('Servers', `${d.servers.enabled}/${d.servers.total}`, `${d.servers.featured} featured`)] : [])))
  root.append(h('div', { class: 'sp' }))
  const blocks = []
  if (d.analytics) {
    blocks.push(h('div', { class: 'card' }, h('h3', null, 'App opens (14 days)'), spark(d.analytics.daily, 'app_open')))
    blocks.push(h('div', { class: 'card' }, h('h3', null, 'Launcher versions in use'), bars(d.analytics.launcherVersions)))
    blocks.push(h('div', { class: 'card' }, h('h3', null, 'Operating systems'), bars(d.analytics.os)))
  }
  if (d.diagnostics) blocks.push(h('div', { class: 'card' }, h('h3', null, 'Issues by category (7 days)'), bars(d.diagnostics.byCategory, 'key', 'count')))
  if (d.campaigns) {
    blocks.push(h('div', { class: 'card' }, h('h3', null, `Campaigns (${d.campaigns.active} active, last 30 days)`),
      table([{ label: 'Campaign', key: 'name' }, { label: 'Impr.', render: r => num(r.impressions) }, { label: 'Clicks', render: r => num(r.clicks) }, { label: 'CTR', render: r => `${r.ctr}%` }], d.campaigns.top, { empty: 'No active campaigns.' })))
  }
  if (d.releases) {
    blocks.push(h('div', { class: 'card' }, h('h3', null, 'Live releases'),
      table([{ label: 'Channel', render: r => badge(r.channel, 'blue') }, { label: 'Platform', render: r => `${r.platform}/${r.arch}` }, { label: 'Version', key: 'version', class: 'mono' }], d.releases, { empty: 'No release published yet.' })))
  }
  root.append(h('div', { class: 'grid g2' }, blocks))
  if (!blocks.length) root.append(h('div', { class: 'card muted' }, 'Your role has no dashboard widgets. Use the menu to open the sections you can manage.'))
}
