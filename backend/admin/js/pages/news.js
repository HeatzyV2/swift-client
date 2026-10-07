import { api } from '../api.js'
import { formModal } from '../form.js'
import { badge, clear, confirmDialog, fail, first, fmtDate, h, pageHead, statusBadge, table, tabs, toast } from '../ui.js'
import { paginated } from './_kit.js'

const newsFields = [
  { key: 'title', label: 'Title', type: 'localized', max: 160, required: true },
  { key: 'summary', label: 'Summary (card text)', type: 'localized', max: 400, required: true },
  { key: 'body', label: 'Article body', type: 'localized', multiline: true, max: 8000 },
  { key: 'image', label: 'Cover image', type: 'image', nullable: true },
  { key: 'url', label: 'External link', type: 'url', nullable: true, hint: 'Optional: opens when the card is clicked.' },
  { key: 'category', label: 'Category', type: 'text', max: 30, nullable: true, placeholder: 'Update, Event, Community…' },
  { key: 'direct', label: 'Open the link directly (skip the article)', type: 'bool' },
  { key: 'pinned', label: 'Pin to the top', type: 'bool' },
  { key: 'status', label: 'Status', type: 'select', options: [['draft', 'Draft'], ['scheduled', 'Scheduled'], ['published', 'Published'], ['archived', 'Archived']] },
  { key: 'publishAt', label: 'Publish at', type: 'datetime', nullable: true, hint: 'Required for Scheduled. The news goes live by itself at that time.' },
]

export default async function render(root, { can }) {
  const body = h('div', null)
  let tab = 'news'
  const head = h('div', null)
  root.append(head, body)

  function drawHead() {
    clear(head).append(pageHead('News & changelog', 'What launchers show on the home page. Scheduled items publish by themselves.',
      tab === 'news' && can('news.write') ? h('button', { class: 'btn primary', onclick: () => editNews() }, '+ New article') : null,
      tab === 'changelog' && can('news.publish') ? h('button', { class: 'btn primary', onclick: () => editLog() }, '+ New entry') : null),
    tabs([['news', 'Articles'], ['changelog', 'Changelog']], tab, (t) => { tab = t; drawHead(); drawBody() }))
  }

  let reload = async () => {}
  async function drawBody() {
    clear(body)
    if (tab === 'news') {
      const r = await paginated(body, {
        endpoint: '/news', filters: [{ key: 'status', label: 'All statuses', options: ['draft', 'scheduled', 'published', 'archived'] }],
        build: (items, load) => table([
          { label: 'Title', render: n => h('div', null, h('b', null, first(n.title)), n.pinned ? ' 📌' : '', h('div', { class: 'faint' }, n.slug)) },
          { label: 'Status', render: n => h('div', null, statusBadge(n.effectiveStatus), n.status === 'scheduled' && n.effectiveStatus !== 'published' ? h('div', { class: 'faint' }, fmtDate(n.publishAt)) : null) },
          { label: 'Category', render: n => n.category ?? '–' },
          { label: 'Updated', render: n => fmtDate(n.updatedAt) },
          { label: '', class: 'actions-cell', render: n => h('div', { class: 'flex', style: { justifyContent: 'flex-end' } },
            can('news.write') ? h('button', { class: 'btn sm', onclick: () => editNews(n) }, 'Edit') : null,
            can('news.publish') && n.effectiveStatus !== 'published' ? h('button', { class: 'btn sm primary', onclick: () => setStatus(n, 'published') }, 'Publish') : null,
            can('news.publish') && n.effectiveStatus === 'published' ? h('button', { class: 'btn sm', onclick: () => setStatus(n, 'archived') }, 'Archive') : null,
            can('news.write') && n.effectiveStatus !== 'published' ? h('button', { class: 'btn sm danger', onclick: () => del(n) }, 'Delete') : null) },
        ], items, { empty: 'No articles yet.' }),
      })
      reload = r.reload
    } else {
      const logs = await api('GET', '/changelog')
      body.append(table([
        { label: 'Version', render: e => h('b', { class: 'mono' }, e.version) }, { label: 'Date', key: 'date' }, { label: 'Status', render: e => statusBadge(e.status) },
        { label: 'Items', render: e => h('ul', { style: { margin: 0, paddingLeft: '16px' } }, e.items.slice(0, 3).map(i => h('li', null, first(i))), e.items.length > 3 ? h('li', { class: 'faint' }, `+${e.items.length - 3} more`) : null) },
        { label: '', class: 'actions-cell', render: e => can('news.publish') ? h('div', { class: 'flex', style: { justifyContent: 'flex-end' } }, h('button', { class: 'btn sm', onclick: () => editLog(e) }, 'Edit'),
          h('button', { class: 'btn sm danger', onclick: async () => { if (await confirmDialog('Delete entry', `Delete changelog ${e.version}?`, { danger: true, label: 'Delete' })) { try { await api('DELETE', `/changelog/${e.id}`); drawBody() } catch (x) { fail(x) } } } }, 'Delete')) : null },
      ], logs, { empty: 'No changelog entries.' }))
    }
  }

  function editNews(n) {
    formModal({
      title: n ? 'Edit article' : 'New article', wide: true, fields: newsFields.filter(f => can('news.publish') || f.key !== 'status' || true),
      initial: n ?? { status: 'draft' },
      onSubmit: async (v) => {
        if (v.status === 'scheduled' && !v.publishAt) throw new Error('Choose a publish date for scheduled articles')
        const payload = { ...v, direct: !!v.direct, pinned: !!v.pinned }
        if (n) await api('PUT', `/news/${n.id}`, payload)
        else await api('POST', '/news', payload)
        toast('Article saved', 'ok')
        reload()
      },
    })
  }

  async function setStatus(n, status) {
    if (!(await confirmDialog(status === 'published' ? 'Publish article' : 'Archive article', `${status === 'published' ? 'Publish' : 'Archive'} "${first(n.title)}"?`, { label: status === 'published' ? 'Publish' : 'Archive' }))) return
    try { await api('POST', `/news/${n.id}/status`, { status }); toast('Done', 'ok'); reload() } catch (e) { fail(e) }
  }

  async function del(n) {
    if (!(await confirmDialog('Delete article', `Delete "${first(n.title)}" permanently?`, { danger: true, label: 'Delete' }))) return
    try { await api('DELETE', `/news/${n.id}`); reload() } catch (e) { fail(e) }
  }

  function editLog(e) {
    formModal({
      title: e ? `Edit ${e.version}` : 'New changelog entry', wide: true,
      fields: [
        { key: 'version', label: 'Version', required: true, max: 32, placeholder: '1.4.0' },
        { key: 'date', label: 'Date (YYYY-MM-DD)', required: true, placeholder: new Date().toISOString().slice(0, 10) },
        { key: 'status', label: 'Status', type: 'select', options: [['published', 'Published'], ['draft', 'Draft']] },
        { key: 'items', label: 'Items (JSON list of localized lines)', type: 'json', required: true, rows: 8 },
      ],
      initial: e ?? { status: 'published', date: new Date().toISOString().slice(0, 10), items: [{ en: 'Faster launches', fr: 'Lancements plus rapides' }] },
      onSubmit: async (v) => {
        if (e) await api('PUT', `/changelog/${e.id}`, v)
        else await api('POST', '/changelog', v)
        toast('Saved', 'ok')
        drawBody()
      },
    })
  }

  drawHead()
  await drawBody()
}
