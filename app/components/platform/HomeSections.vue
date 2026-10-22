<template>
  <div v-if="sections.length" class="flex flex-col gap-5">
    <template v-for="s in sections" :key="s.id">
      <!-- Hero -->
      <section v-if="s.kind === 'hero'" class="sw-panel relative overflow-hidden">
        <img v-if="s.imageUrl" :src="s.imageUrl" alt="" class="absolute inset-0 size-full object-cover opacity-50">
        <div class="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-transparent" />
        <div class="relative flex min-h-[170px] flex-col justify-end gap-2 p-6">
          <span v-if="s.badge" class="w-fit rounded-[6px] bg-primary px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white">{{ s.badge }}</span>
          <h2 v-if="s.title" class="font-display text-[24px] font-semibold leading-tight text-white">{{ s.title }}</h2>
          <p v-if="s.subtitle" class="max-w-2xl text-[13.5px] text-white/80">{{ s.subtitle }}</p>
          <UButton v-if="s.cta" class="mt-1 w-fit" color="primary" :label="s.cta.label" trailing-icon="i-lucide-corner-right-up" @click="open(s.cta.url)" />
        </div>
      </section>

      <!-- Banner image -->
      <button v-else-if="s.kind === 'banner' && s.imageUrl" type="button" class="sw-panel block overflow-hidden p-0 text-left" :class="s.url ? 'cursor-pointer' : 'cursor-default'" @click="s.url && open(s.url)">
        <img :src="s.imageUrl" :alt="s.alt || s.title" class="block max-h-[220px] w-full object-cover">
      </button>

      <!-- Text -->
      <section v-else-if="s.kind === 'text'" class="sw-panel p-5">
        <h2 v-if="s.title" class="mb-2 font-display text-[16px] font-semibold text-highlighted">{{ s.title }}</h2>
        <p class="whitespace-pre-line text-[13px] leading-relaxed text-muted">{{ s.body }}</p>
      </section>

      <!-- Quick links -->
      <section v-else-if="s.kind === 'links' && s.items?.length" class="flex flex-wrap items-center gap-2">
        <h2 v-if="s.title" class="mr-1 font-display text-[14px] font-semibold text-highlighted">{{ s.title }}</h2>
        <UButton v-for="(l, i) in s.items" :key="i" size="sm" color="neutral" variant="soft" :label="l.label" trailing-icon="i-lucide-corner-right-up" @click="open(l.url)" />
      </section>

      <!-- Servers -->
      <section v-else-if="s.kind === 'servers' && s.items?.length">
        <h2 v-if="s.title" class="mb-3 font-display text-[18px] font-semibold text-highlighted">{{ s.title }}</h2>
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <article v-for="srv in s.items" :key="srv.id" class="sw-panel flex flex-col gap-3 p-4">
            <div class="flex items-center gap-3">
              <img v-if="srv.iconUrl" :src="srv.iconUrl" alt="" class="size-10 shrink-0 rounded-lg">
              <div v-else class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--sw-surface-3)]">
                <UIcon name="i-lucide-server" class="size-5 text-dimmed" />
              </div>
              <div class="min-w-0">
                <p class="flex items-center gap-1.5 truncate font-display text-[15px] font-semibold text-highlighted">
                  {{ srv.name }}
                  <UIcon v-if="srv.verified" name="i-lucide-check" class="size-4 shrink-0 text-[var(--sw-success)]" :title="t('platform.verified')" />
                </p>
                <p class="truncate font-mono text-[11px] text-dimmed">{{ address(srv) }}</p>
              </div>
            </div>
            <p v-if="srv.description" class="line-clamp-2 text-[12px] leading-relaxed text-muted">{{ srv.description }}</p>
            <div class="mt-auto flex items-center justify-between gap-2">
              <div class="flex flex-wrap gap-1">
                <span v-for="tag in (srv.tags ?? []).slice(0, 3)" :key="tag" class="rounded-[6px] bg-[var(--sw-surface-3)] px-1.5 py-0.5 text-[10.5px] text-muted">{{ tag }}</span>
              </div>
              <div class="flex gap-1.5">
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-clipboard" square :aria-label="t('platform.copy')" @click="copy(address(srv))" />
                <UButton v-if="canPlay && srv.edition !== 'bedrock'" size="xs" color="primary" icon="i-lucide-play" :label="t('platform.play')" @click="play({ serverId: srv.id, host: srv.address, port: srv.port })" />
              </div>
            </div>
          </article>
        </div>
      </section>

      <!-- Partners (campaigns) -->
      <section v-else-if="s.kind === 'partners' && s.items?.length">
        <h2 v-if="s.title" class="mb-3 font-display text-[18px] font-semibold text-highlighted">{{ s.title }}</h2>
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <article v-for="c in s.items" :key="c.id" v-impression="() => seen(c.id)" class="sw-panel relative overflow-hidden">
            <img v-if="c.imageUrl" :src="c.imageUrl" alt="" class="absolute inset-0 size-full object-cover opacity-40">
            <div class="absolute inset-0 bg-gradient-to-t from-black/75 to-black/10" />
            <div class="relative flex min-h-[140px] flex-col justify-end gap-1.5 p-4">
              <span class="w-fit rounded-[6px] bg-black/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/80">{{ t('platform.partner') }}</span>
              <p class="font-display text-[16px] font-semibold text-white">{{ c.title }}</p>
              <p v-if="c.subtitle" class="line-clamp-2 text-[12px] text-white/75">{{ c.subtitle }}</p>
              <div class="mt-1 flex gap-2">
                <UButton v-if="c.cta" size="xs" color="primary" :label="c.cta.label" @click="clicked(c); open(c.cta.url)" />
                <UButton v-if="c.server && canPlay" size="xs" color="neutral" variant="soft" icon="i-lucide-play" :label="t('platform.play')" @click="clicked(c); play({ serverId: c.server.id, campaignId: c.id, host: c.server.address, port: c.server.port })" />
              </div>
            </div>
          </article>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Directive } from 'vue'

const { t } = useI18n()
const toast = useToast()
const instances = useInstancesStore()
const launchFlow = useLaunchFlow()
const { homeSections } = useSwiftPlatform()

/** The news carousel already has its own place on the Home: only the other kinds are drawn here. */
const sections = computed(() => homeSections.value.filter(s => s.kind !== 'news'))
const canPlay = computed(() => !!instances.selected)

const open = (url: string) => { void openExternal(url) }
const address = (s: { address: string, port?: number }) => (s.port && s.port !== 25565 ? `${s.address}:${s.port}` : s.address)

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.add({ title: t('servers.copied'), color: 'success' })
  } catch (e) {
    toast.add({ title: errorText(e), color: 'error' })
  }
}

async function play(target: { serverId: string, campaignId?: string, host: string, port?: number }) {
  const inst = instances.selected
  if (!inst) return
  track('server_play_attempt', { serverId: target.serverId, campaignId: target.campaignId })
  const started = await launchFlow.play(inst.id, { kind: 'Multiplayer', host: target.host, port: target.port && target.port !== 25565 ? target.port : undefined })
  if (started) track('server_launch', { serverId: target.serverId, campaignId: target.campaignId })
}

// Campaign impressions: once per campaign and session, when the card is actually on screen
const impressed = new Set<string>()
function seen(id: string) {
  if (impressed.has(id)) return
  impressed.add(id)
  track('campaign_impression', { campaignId: id })
}
function clicked(c: { id: string }) {
  track('campaign_click', { campaignId: c.id })
}

const vImpression: Directive<HTMLElement, () => void> = {
  mounted(el, binding) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) { binding.value(); io.disconnect() }
    }, { threshold: 0.5 })
    io.observe(el)
    ;(el as HTMLElement & { _io?: IntersectionObserver })._io = io
  },
  unmounted(el) {
    ;(el as HTMLElement & { _io?: IntersectionObserver })._io?.disconnect()
  },
}
</script>
