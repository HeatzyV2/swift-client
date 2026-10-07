import { api } from '../api.js'
import { buildForm } from '../form.js'
import { badge, confirmDialog, fail, h, pageHead, setDirty, toast } from '../ui.js'

export default async function render(root, { user, can }) {
  const w = can('settings.write')
  const s = can('settings.read') ? await api('GET', '/settings') : null

  root.append(pageHead('Settings', 'Your account, and the platform-wide switches.'))

  // Account
  const cur = h('input', { type: 'password', autocomplete: 'current-password' })
  const next = h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'At least 10 characters' })
  root.append(h('div', { class: 'grid g2' },
    h('div', { class: 'card' }, h('h3', null, 'My account'),
      h('p', null, h('b', null, user.username), ' ', ...user.roles.map(r => badge(r, 'blue'))),
      h('div', { class: 'faint', style: { marginBottom: '10px' } }, `${user.permissions.length} permissions`),
      h('div', { class: 'field' }, h('label', null, 'Current password'), cur),
      h('div', { class: 'field' }, h('label', null, 'New password'), next),
      h('div', { class: 'actions' },
        h('button', { class: 'btn primary', onclick: async () => {
          try { await api('POST', '/auth/change-password', { currentPassword: cur.value, newPassword: next.value }); toast('Password changed. Signing you out…', 'ok'); setTimeout(() => location.reload(), 1200) } catch (e) { fail(e) }
        } }, 'Change password'),
        h('button', { class: 'btn', onclick: async () => { if (await confirmDialog('Sign out everywhere', 'End all your sessions on every device?', { label: 'Sign out' })) { try { await api('POST', '/auth/logout-all'); location.reload() } catch (e) { fail(e) } } } }, 'Sign out everywhere'))),
    s ? settingsCard('analytics', 'Analytics', s.analytics, [{ key: 'enabled', label: 'Collect anonymous launcher analytics', type: 'bool', hint: 'Whitelisted events only, pseudonymous device id, no IP stored. Launchers are told via bootstrap.' }], w, (v) => ({ enabled: !!v.enabled })) : null,
    s ? settingsCard('links', 'Public links', s.links, [
      { key: 'website', label: 'Website', type: 'url', nullable: true }, { key: 'discord', label: 'Discord', type: 'url', nullable: true },
      { key: 'support', label: 'Support', type: 'url', nullable: true }, { key: 'status', label: 'Status page', type: 'url', nullable: true }, { key: 'privacy', label: 'Privacy policy', type: 'url', nullable: true },
    ], w, (v) => v) : null))
}

function settingsCard(key, title, value, fields, writable, toBody) {
  const form = buildForm(fields, value)
  return h('div', { class: 'card' }, h('h3', null, title), form.el, writable ? h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: async () => {
    let v
    try { v = form.get() } catch (e) { toast(e.message, 'err'); return }
    try { await api('PUT', `/settings/${key}`, toBody(v)); setDirty(false); toast(`${title} saved`, 'ok') } catch (e) { fail(e) }
  } }, 'Save')) : h('div', { class: 'faint' }, 'Read only'))
}
