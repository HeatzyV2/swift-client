import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import type { Instance, Loader, Settings } from '~/types/launcher'

function byRecentPlay(a: Instance, b: Instance) {
  return (b.last_played ?? '').localeCompare(a.last_played ?? '')
}

export const useInstancesStore = defineStore('instances', {
  state: () => ({
    instances: [] as Instance[],
    /** The instance Home launches. Persisted as `last_instance_id` in launcher.json. */
    selectedId: null as string | null,
    loading: false,
    loaded: false,
    error: null as string | null,
  }),
  getters: {
    selected(state): Instance | undefined {
      return state.instances.find(i => i.id === state.selectedId)
    },
    recent(state): Instance[] {
      return [...state.instances].filter(i => i.last_played).sort(byRecentPlay)
    },
  },
  actions: {
    async load() {
      this.loading = true
      this.error = null
      try {
        const [list, settings] = await Promise.all([
          invoke<Instance[]>('list_instances'),
          this.loaded ? Promise.resolve(null) : invoke<Settings>('get_settings').catch(() => null),
        ])
        this.instances = list
        if (settings?.last_instance_id) this.selectedId = settings.last_instance_id
        this.loaded = true
        if (!this.instances.some(i => i.id === this.selectedId)) {
          this.selectedId = [...this.instances].sort(byRecentPlay)[0]?.id ?? null
        }
      } catch (e) {
        this.error = errorText(e)
      } finally {
        this.loading = false
      }
    },

    async ensureLoaded() {
      if (!this.loaded) await this.load()
    },

    select(id: string | null) {
      if (this.selectedId === id) return
      this.selectedId = id
      invoke('set_last_instance', { id }).catch(() => {})
    },

    async create(opts: {
      name: string
      mcVersion: string
      loader: Loader
      memoryMb?: number
      iconSourcePath?: string | null
    }) {
      const instance = await invoke<Instance>('create_instance', {
        name: opts.name,
        mcVersion: opts.mcVersion,
        loader: opts.loader,
        memoryMb: opts.memoryMb ?? null,
        iconSourcePath: opts.iconSourcePath ?? null,
      })
      this.instances.unshift(instance)
      this.select(instance.id)
      return instance
    },

    async update(instance: Instance) {
      await invoke('update_instance', { instance })
      const idx = this.instances.findIndex(i => i.id === instance.id)
      if (idx !== -1) this.instances[idx] = instance
    },

    async remove(id: string) {
      await invoke('delete_instance', { id })
      this.instances = this.instances.filter(i => i.id !== id)
      if (this.selectedId === id) this.select([...this.instances].sort(byRecentPlay)[0]?.id ?? null)
    },
  },
})
