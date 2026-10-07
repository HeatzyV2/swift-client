import { api } from '../api.js'
import { badge, confirmDialog, fail, fmtDate, h, modal, pageHead, table, toast, ago } from '../ui.js'
import { paginated } from './_kit.js'

export default async function render(root, { user, can }) {
  const manage = can('users.manage')
  const roles = await api('GET', '/roles')
  let reload = async () => {}

  function editRoles(u) {
    const boxes = roles.map(r => ({ r, i: h('input', { type: 'checkbox', checked: u.roles.includes(r.role) }) }))
    modal({ title: `Roles of ${u.username}`, wide: true,
      body: h('div', null, h('p', { class: 'muted' }, 'Roles are applied immediately. You can only grant or revoke roles below your own rank.'),
        boxes.map(({ r, i }) => h('label', { class: 'check', style: { padding: '8px 0', borderBottom: '1px solid var(--line)', alignItems: 'flex-start' } }, i,
          h('div', null, h('b', null, r.role), h('div', { class: 'faint', style: { fontSize: '12px' } }, r.permissions.join(', ')))))),
      actions: [{ label: 'Cancel' }, { label: 'Save roles', kind: 'primary', run: async () => { await api('PUT', `/users/${u.id}/roles`, { roles: boxes.filter(b => b.i.checked).map(b => b.r.role) }); toast('Roles updated', 'ok'); reload() } }] })
  }

  async function toggleDisabled(u) {
    const to = !u.disabled
    if (!(await confirmDialog(to ? 'Disable account' : 'Enable account', to ? `${u.username} will be signed out and unable to sign in (launcher and platform).` : `Allow ${u.username} to sign in again?`, { danger: to, label: to ? 'Disable' : 'Enable' }))) return
    try { await api('POST', `/users/${u.id}/disabled`, { disabled: to }); toast('Updated', 'ok'); reload() } catch (e) { fail(e) }
  }

  root.append(pageHead('Users & roles', 'Swift accounts and platform staff. Grant the first OWNER from the server console: node dist/admin.js role grant <player> OWNER.'))
  const r = await paginated(root, {
    endpoint: '/users', filters: [{ key: 'role', label: 'Any role', options: roles.map(x => x.role) }, { key: 'staff', label: 'Everyone', options: [] }].slice(0, 1),
    build: (items) => table([
      { label: 'Account', render: u => h('div', null, h('b', null, u.username), u.id === user.id ? ' (you)' : '', h('div', { class: 'faint' }, u.minecraft ? `MC: ${u.minecraft.username}` : 'No Minecraft link')) },
      { label: 'Roles', render: u => h('div', { class: 'flex', style: { flexWrap: 'wrap' } }, u.roles.length ? u.roles.map(r => badge(r, 'blue')) : [h('span', { class: 'faint' }, '–')]) },
      { label: 'Status', render: u => u.disabled ? badge('disabled', 'bad') : badge('active', 'ok') },
      { label: 'Last seen', render: u => ago(u.lastSeen) },
      { label: 'Joined', render: u => fmtDate(u.createdAt) },
      { label: '', class: 'actions-cell', render: u => manage && u.id !== user.id ? h('div', { class: 'flex', style: { justifyContent: 'flex-end' } }, h('button', { class: 'btn sm', onclick: () => editRoles(u) }, 'Roles'), h('button', { class: `btn sm ${u.disabled ? '' : 'danger'}`, onclick: () => toggleDisabled(u) }, u.disabled ? 'Enable' : 'Disable')) : null },
    ], items, { empty: 'No accounts match.' }),
  })
  reload = r.reload
}
