import { api } from '../api.js'
import { buildForm } from '../form.js'
import { badge, confirmDialog, h, pageHead, setDirty, toast, fail } from '../ui.js'

export default async function render(root, { can }) {
  const w = can('settings.write')
  const settings = await api('GET', '/settings')
  const m = settings.maintenance
  const active = m.enabled && (!m.startsAt || m.startsAt <= new Date().toISOString()) && (!m.endsAt || m.endsAt > new Date().toISOString())
  const form = buildForm([
    { key: 'enabled', label: 'Maintenance mode', type: 'bool', hint: 'When on, launchers receive maintenance.active = true and show your message.' },
    { key: 'message', label: 'Message shown to players', type: 'localized', multiline: true, max: 400 },
    { key: 'startsAt', label: 'Starts at (optional)', type: 'datetime', nullable: true, hint: 'Schedule the maintenance window ahead of time.' },
    { key: 'endsAt', label: 'Ends at (optional)', type: 'datetime', nullable: true },
    { key: 'allowVersions', label: 'Launcher versions allowed through (testers)', type: 'tags', placeholder: '1.5.0-beta.1' },
  ], m)
  root.append(pageHead('Maintenance', 'Tell every launcher the service is down, with a scheduled window and a message in each language.', active ? badge('ACTIVE', 'bad') : badge('inactive', 'ok')))
  if (active) root.append(h('div', { class: 'banner bad' }, '⚒ Maintenance is active right now.'))
  root.append(h('div', { class: 'card', style: { maxWidth: '760px' } }, form.el, w ? h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: async () => {
    let v
    try { v = form.get() } catch (e) { toast(e.message, 'err'); return }
    const body = { enabled: !!v.enabled, message: v.message ?? {}, startsAt: v.startsAt ?? null, endsAt: v.endsAt ?? null, allowVersions: v.allowVersions ?? [] }
    if (body.enabled && !body.startsAt && !(await confirmDialog('Enable maintenance', 'Launchers will show the maintenance screen immediately. Continue?', { danger: true, label: 'Enable now' }))) return
    try { await api('PUT', '/settings/maintenance', body); setDirty(false); toast('Maintenance settings saved', 'ok'); location.reload() } catch (e) { fail(e) }
  } }, 'Save')) : null))
  setDirty(false)
}
