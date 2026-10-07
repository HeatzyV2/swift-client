import { api, apiFull, qs } from '../api.js'
import { clear, confirmDialog, debounce, fail, fmtDate, h, modal, pageHead, pager, toast, skeleton } from '../ui.js'

const kb = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

export default async function render(root, { can }) {
  const grid = h('div', { class: 'thumbs' })
  const holder = h('div', null, grid)
  const search = h('input', { type: 'search', placeholder: 'Search by name or alt text…' })
  const pg = h('div', null)
  let page = 1
  const w = can('assets.write')

  async function load() {
    try {
      const { data, meta } = await apiFull('GET', `/assets${qs({ page, limit: 36, q: search.value.trim() })}`)
      clear(grid).append(...(data.length ? data.map(a => h('div', { class: 'thumb', onclick: () => detail(a) },
        h('div', { class: 'im', style: { backgroundImage: `url("${a.url}")` } }), h('div', { class: 'meta' }, h('b', null, a.filename), `${a.width}×${a.height} · ${kb(a.size)}`))) : [h('div', { class: 'empty', style: { gridColumn: '1/-1' } }, 'No assets yet. Drop images above.')]))
      clear(pg).append(pager(meta, (p) => { page = p; load() }))
    } catch (e) { fail(e) }
  }

  async function upload(files) {
    for (const file of files) {
      const fd = new FormData()
      fd.append('file', file)
      try { await api('POST', '/assets', fd, true); toast(`${file.name} uploaded`, 'ok') } catch (e) { fail(e) }
    }
    load()
  }

  function detail(a) {
    const alt = h('input', { type: 'text', value: a.alt ?? '', maxlength: 200, disabled: !w })
    modal({ title: a.filename, wide: true,
      body: h('div', { class: 'row' },
        h('div', { class: 'preview', style: { textAlign: 'center' } }, h('img', { src: a.url, alt: '', style: { maxWidth: '100%', maxHeight: '320px' } })),
        h('div', null,
          h('div', { class: 'field' }, h('label', null, 'Reference (use in sections, news, servers)'), h('input', { type: 'text', value: a.ref, readonly: true, onclick: (e) => e.target.select() })),
          h('div', { class: 'field' }, h('label', null, 'Public URL'), h('input', { type: 'text', value: a.url, readonly: true, onclick: (e) => e.target.select() })),
          h('div', { class: 'field' }, h('label', null, 'Alt text'), alt),
          h('div', { class: 'faint mono' }, `${a.mime} · ${a.width}×${a.height} · ${kb(a.size)}`, h('br'), `sha256 ${a.sha256.slice(0, 16)}…`, h('br'), fmtDate(a.createdAt)))),
      actions: [
        w ? { label: 'Delete', kind: 'danger', run: async () => { if (!(await confirmDialog('Delete asset', 'Delete this file? It must not be used anywhere.', { danger: true, label: 'Delete' }))) return false; await api('DELETE', `/assets/${a.id}`); toast('Deleted', 'ok'); load() } } : null,
        { label: 'Close' },
        w ? { label: 'Save alt text', kind: 'primary', run: async () => { await api('PATCH', `/assets/${a.id}`, { alt: alt.value.trim() }); toast('Saved', 'ok'); load() } } : null,
      ].filter(Boolean) })
  }

  const file = h('input', { type: 'file', multiple: true, accept: 'image/png,image/jpeg,image/webp,image/gif', style: { display: 'none' }, onchange: (e) => upload([...e.target.files]) })
  const drop = h('div', { class: 'drop' }, 'Drop images here or ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); file.click() } }, 'browse'), h('div', { class: 'faint' }, 'PNG, JPEG, WebP or GIF · checked by content · identical files are deduplicated'), file)
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over') })
  drop.addEventListener('dragleave', () => drop.classList.remove('over'))
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); upload([...e.dataTransfer.files]) })
  search.addEventListener('input', debounce(() => { page = 1; load() }))

  root.append(pageHead('Assets', 'Images used by the home, news, servers and campaigns. Served from the CDN host.'), w ? drop : null, h('div', { class: 'sp' }), h('div', { class: 'toolbar' }, search), holder, pg)
  await load()
}
