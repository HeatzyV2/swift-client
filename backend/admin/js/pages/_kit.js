// Shared helpers for list pages.
import { apiFull, qs } from '../api.js'
import { clear, debounce, fail, h, pager, skeleton } from '../ui.js'

/** A paginated, searchable list. `build(items, reload)` returns the element to show. */
export function paginated(root, { endpoint, extra = () => ({}), build, search = true, filters = [], limit = 25 }) {
  const holder = h('div', null)
  const state = { page: 1, q: '' }
  const bar = h('div', { class: 'toolbar' })
  const filterEls = {}
  if (search) {
    const i = h('input', { type: 'search', placeholder: 'Search…', oninput: debounce(() => { state.q = i.value.trim(); state.page = 1; load() }) })
    bar.append(i)
  }
  for (const f of filters) {
    const s = h('select', { onchange: () => { state.page = 1; load() } }, h('option', { value: '' }, f.label), f.options.map(o => h('option', { value: o }, o)))
    filterEls[f.key] = s
    bar.append(s)
  }
  async function load() {
    const params = { page: state.page, limit, q: state.q || undefined, ...Object.fromEntries(Object.entries(filterEls).map(([k, s]) => [k, s.value || undefined])), ...extra() }
    try {
      const { data, meta } = await apiFull('GET', `${endpoint}${qs(params)}`)
      clear(holder).append(build(data, load), pager(meta, (p) => { state.page = p; load() }))
    } catch (e) { clear(holder); fail(e) }
  }
  root.append(bar, holder)
  holder.append(skeleton())
  return load().then(() => ({ reload: load }))
}
