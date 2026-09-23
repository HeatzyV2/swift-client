<template>
  <component
    :is="clickable ? 'button' : 'div'"
    :type="clickable ? 'button' : undefined"
    class="flex h-9 items-center gap-2.5 rounded-lg border border-[var(--sw-line)] bg-[var(--sw-surface)] px-3.5 text-xs font-medium transition-colors"
    :class="clickable ? 'hover:border-[var(--sw-line-strong)] hover:bg-[var(--sw-surface-2)]' : ''"
    :title="clickable ? $t('activity.openLogs') : undefined"
    @click="onClick"
  >
    <template v-if="view.kind === 'install' || view.kind === 'task'">
      <UIcon name="i-lucide-loader-circle" class="size-3.5 shrink-0 animate-spin text-primary" />
      <span class="max-w-56 truncate text-toned">{{ view.label }}</span>
      <template v-if="view.percent !== null">
        <span class="font-mono text-[11px] tabular-nums text-muted">{{ view.percent }}%</span>
        <span class="relative h-[3px] w-14 overflow-hidden rounded-full bg-white/8">
          <span class="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-200" :style="{ width: `${view.percent}%` }" />
        </span>
      </template>
    </template>
    <template v-else>
      <span class="relative flex size-2">
        <span v-if="view.kind === 'running'" class="absolute inset-0 animate-ping rounded-full bg-[var(--sw-success)] opacity-50 [animation-duration:2s]" />
        <span class="relative size-2 rounded-full" :class="view.kind === 'running' ? 'bg-[var(--sw-success)]' : 'bg-neutral-600'" />
      </span>
      <span :class="view.kind === 'running' ? 'text-toned' : 'text-muted'">{{ view.label }}</span>
    </template>
  </component>
</template>

<script setup lang="ts">
const ac = useActivityCenter()
const instances = useInstancesStore()
const { t } = useI18n()

const nameFor = (id: string) => instances.instances.find(i => i.id === id)?.name ?? t('activity.unknownInstance')
const percentOf = (current: number, total: number) => (total > 0 ? Math.min(100, Math.round((current / total) * 100)) : null)

const running = computed(() => ac.list.value.filter(a => a.kind === 'running'))

const view = computed(() => {
  const top = ac.top.value
  const mp = ac.modpack.value
  if (mp) return { kind: 'install', label: t('activity.downloadingPack', { name: mp.name }), percent: percentOf(mp.current, mp.total) }
  if (top?.kind === 'install') return { kind: 'install', label: t('activity.downloading', { name: nameFor(top.instanceId) }), percent: percentOf(top.current, top.total) }
  const labels = ac.taskLabels.value
  if (labels.length) return { kind: 'task', label: labels.length > 1 ? t('activity.tasks', { n: labels.length }) : labels[0]!, percent: null }
  if (running.value.length === 1) return { kind: 'running', label: t('activity.running', { name: nameFor(running.value[0]!.instanceId) }), percent: null }
  if (running.value.length > 1) return { kind: 'running', label: t('status.runningMany', { n: running.value.length }), percent: null }
  return { kind: 'idle', label: t('status.idle'), percent: null }
})

const clickable = computed(() => running.value.length > 0)

function onClick() {
  if (clickable.value) ac.openLiveLogs(running.value[0]!.instanceId)
}
</script>
