<template>
  <Transition name="sw-fade" mode="out-in">
    <component
      :is="clickable ? 'button' : 'div'"
      v-if="view"
      :key="view.kind"
      :type="clickable ? 'button' : undefined"
      style="-webkit-app-region: no-drag"
      class="flex h-7 items-center gap-2 rounded-md px-2.5 text-xs transition-colors"
      :class="clickable ? 'hover:bg-[var(--sw-surface-3)]' : ''"
      :title="clickable ? $t('activity.openLogs') : view.label"
      @click="onClick"
    >
      <template v-if="view.kind === 'install'">
        <UIcon name="i-lucide-loader-circle" class="size-3.5 shrink-0 animate-spin text-primary" />
        <span class="max-w-56 truncate text-toned">{{ view.label }}</span>
        <span v-if="view.percent !== null" class="shrink-0 font-mono text-[11px] tabular-nums text-muted">{{ view.percent }}%</span>
        <span class="relative h-[3px] w-16 shrink-0 overflow-hidden rounded-full bg-white/8">
          <span
            class="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-200"
            :style="{ width: (view.percent ?? 0) + '%' }"
          />
        </span>
      </template>

      <template v-else-if="view.kind === 'task'">
        <UIcon name="i-lucide-loader-circle" class="size-3.5 shrink-0 animate-spin text-primary" />
        <span class="max-w-64 truncate text-toned">{{ view.label }}</span>
      </template>

      <template v-else>
        <span class="size-1.5 shrink-0 rounded-full bg-[var(--sw-success)]" />
        <span class="max-w-56 truncate text-toned">{{ view.label }}</span>
        <UIcon name="i-lucide-square-terminal" class="size-3.5 shrink-0 text-dimmed" />
      </template>
    </component>
  </Transition>
</template>

<script setup lang="ts">
const ac = useActivityCenter()
const instances = useInstancesStore()
const { t } = useI18n()

const nameFor = (id: string) =>
  instances.instances.find(i => i.id === id)?.name ?? t('activity.unknownInstance')

interface View {
  kind: 'install' | 'task' | 'running'
  label: string
  percent: number | null
}

const percentOf = (current: number, total: number) =>
  total > 0 ? Math.min(100, Math.round((current / total) * 100)) : null

const view = computed<View | null>(() => {
  const top = ac.top.value
  const labels = ac.taskLabels.value

  const mp = ac.modpack.value
  if (mp) {
    return { kind: 'install', label: t('activity.downloadingPack', { name: mp.name }), percent: percentOf(mp.current, mp.total) }
  }
  if (top?.kind === 'install') {
    return { kind: 'install', label: t('activity.downloading', { name: nameFor(top.instanceId) }), percent: percentOf(top.current, top.total) }
  }
  if (labels.length) {
    return { kind: 'task', label: labels.length > 1 ? t('activity.tasks', { n: labels.length }) : labels[0]!, percent: null }
  }
  if (top?.kind === 'running') {
    return { kind: 'running', label: t('activity.running', { name: nameFor(top.instanceId) }), percent: null }
  }
  return null
})

const runningInstance = computed(() => ac.list.value.find(a => a.kind === 'running')?.instanceId ?? null)
const clickable = computed(() => view.value?.kind === 'running' && runningInstance.value !== null)

function onClick() {
  if (clickable.value) ac.openLiveLogs(runningInstance.value ?? undefined)
}
</script>
