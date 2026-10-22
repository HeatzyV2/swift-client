<template>
  <div v-if="findings.length || loaded" class="mb-3 rounded-xl border border-[var(--sw-line)] bg-[var(--sw-surface-2)] px-4 py-3">
    <p class="sw-eyebrow mb-2 flex items-center gap-2">
      <UIcon name="i-lucide-lightbulb" class="size-3.5 text-[var(--sw-accent)]" />
      {{ $t('crash.diag.title') }}
    </p>

    <p v-if="!findings.length" class="text-xs text-muted">{{ $t('crash.diag.none') }}</p>

    <ul v-else class="space-y-2.5">
      <li v-for="f in findings" :key="f.id + f.args.join('|')" class="flex flex-wrap items-center gap-3">
        <p class="min-w-[220px] flex-1 text-[13px] leading-snug text-highlighted">{{ describe(f) }}</p>
        <UButton
          v-if="f.fix"
          size="xs"
          color="primary"
          variant="soft"
          :icon="fixIcon(f.fix.kind)"
          :label="fixLabel(f.fix)"
          :loading="busy === f.id"
          :disabled="done.has(f.id)"
          @click="apply(f)"
        />
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import type { CrashFinding, CrashFix, Instance } from '~/types/launcher'

const props = defineProps<{ instanceId: string | null, rel: string | null, active: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { t, te } = useI18n()
const toast = useToast()
const router = useRouter()
const instances = useInstancesStore()
const mod = useSwiftMod()

const findings = ref<CrashFinding[]>([])
const loaded = ref(false)
const busy = ref('')
const done = ref(new Set<string>())

async function analyze() {
  findings.value = []
  loaded.value = false
  done.value = new Set()
  if (!props.instanceId) return
  try {
    // A crash with no report still leaves the game log behind
    findings.value = await invoke<CrashFinding[]>('analyze_crash', { instanceId: props.instanceId, rel: props.rel ?? 'logs/latest.log' })
  } catch {
    findings.value = []
  } finally {
    loaded.value = true
  }
}

watch(() => [props.active, props.instanceId, props.rel] as const, ([isActive]) => {
  if (isActive) analyze()
}, { immediate: true })

function describe(f: CrashFinding): string {
  // out_of_memory has a variant per kind of memory (heap, metaspace)
  const key = f.id === 'out_of_memory' ? `crash.diag.out_of_memory.${f.args[0] ?? 'heap'}` : `crash.diag.${f.id}`
  return te(key) ? t(key, { a: f.args[0] ?? '', b: f.args[1] ?? '' }) : f.id
}

function fixIcon(kind: CrashFix['kind']): string {
  return {
    raise_memory: 'i-lucide-zap',
    lower_memory: 'i-lucide-zap',
    rollback_mod: 'i-lucide-undo-2',
    open_mods: 'i-lucide-folder',
    open_java: 'i-lucide-sliders-horizontal',
  }[kind]
}

function fixLabel(fix: CrashFix): string {
  return t(`crash.fix.${fix.kind}`, { mb: fix.value ?? '', version: fix.value ?? '' })
}

/** Changes this instance's memory, which means giving it its own value instead of the launcher default. */
async function setMemory(mb: number) {
  const inst = await invoke<Instance>('get_instance', { id: props.instanceId })
  await invoke('update_instance', { instance: { ...inst, override_memory: true, memory_mb: mb } })
  await instances.load()
  toast.add({ title: t('crash.fix.memorySet', { mb }), color: 'success' })
}

async function apply(f: CrashFinding) {
  const fix = f.fix
  if (!fix || !props.instanceId) return
  busy.value = f.id
  try {
    if (fix.kind === 'raise_memory' || fix.kind === 'lower_memory') {
      await setMemory(Number(fix.value))
    } else if (fix.kind === 'rollback_mod' && fix.value) {
      await mod.useVersion(fix.value)
      toast.add({ title: t('crash.fix.rolledBack', { version: fix.value }), color: 'success' })
    } else if (fix.kind === 'open_mods') {
      emit('close')
      await router.push(`/instance/${props.instanceId}?tab=mods`)
      return
    } else if (fix.kind === 'open_java') {
      emit('close')
      await router.push('/settings?section=minecraft')
      return
    }
    done.value = new Set([...done.value, f.id])
  } catch (e) {
    toast.add({ title: errorText(e), color: 'error' })
  } finally {
    busy.value = ''
  }
}
</script>
