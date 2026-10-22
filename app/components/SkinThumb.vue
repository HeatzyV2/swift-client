<template>
  <div
    class="group relative flex w-[108px] cursor-pointer flex-col overflow-hidden rounded-2xl border transition duration-200"
    :class="selected
      ? 'border-white/80 bg-[var(--sw-surface-3)] shadow-[0_0_0_1px_rgb(255_255_255/0.08)]'
      : 'border-[var(--sw-line)] bg-[var(--sw-surface)] hover:border-[var(--sw-line-strong)] hover:bg-[var(--sw-surface-2)]'"
    @click="$emit('select')"
    @mouseenter="startSpin"
    @mouseleave="stopSpin"
  >
    <div class="relative flex h-[148px] w-full items-end justify-center overflow-hidden bg-[radial-gradient(ellipse_at_50%_30%,var(--sw-surface-3)_0%,transparent_70%)]">
      <canvas
        v-show="spinning"
        ref="canvasEl"
        class="absolute inset-0 size-full"
      />
      <img
        v-show="!spinning && thumb"
        :src="thumb"
        :alt="name"
        draggable="false"
        class="h-full w-full object-contain object-bottom py-2 transition duration-200"
      >
      <div v-if="!thumb && !spinning" class="absolute inset-3 sw-skeleton rounded-xl" />

      <span
        v-if="active"
        class="absolute left-2 top-2 flex size-5 items-center justify-center rounded-full bg-[var(--sw-success)] text-black shadow"
        :title="$t('skins.inUse')"
      >
        <UIcon name="i-lucide-check" class="size-3 stroke-[3]" />
      </span>

      <button
        v-if="removable"
        type="button"
        class="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-lg bg-black/55 text-white/70 opacity-0 backdrop-blur-sm transition group-hover:opacity-100 hover:bg-black/75 hover:text-white"
        :title="$t('common.remove')"
        @click.stop="$emit('remove')"
      >
        <UIcon name="i-lucide-trash-2" class="size-3.5" />
      </button>
    </div>

    <p class="truncate border-t border-[var(--sw-line-soft)] px-2 py-2 text-center text-[11px] font-medium text-toned" :title="name">
      {{ name }}
    </p>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  name: string
  thumb?: string
  /** Raw skin texture (data URL / path). Needed for hover spin. */
  skin?: string
  model?: 'classic' | 'slim'
  selected?: boolean
  active?: boolean
  removable?: boolean
}>()

defineEmits<{ select: [], remove: [] }>()

const canvasEl = ref<HTMLCanvasElement>()
const spinning = ref(false)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let viewer: any = null
let spinToken = 0

async function startSpin() {
  if (!props.skin || !import.meta.client) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const token = ++spinToken
  spinning.value = true
  await nextTick()
  if (token !== spinToken || !canvasEl.value) return

  try {
    const { SkinViewer } = await import('skinview3d')
    if (token !== spinToken || !canvasEl.value) return

    viewer?.dispose?.()
    const w = canvasEl.value.clientWidth || 108
    const h = canvasEl.value.clientHeight || 148
    viewer = new SkinViewer({
      canvas: canvasEl.value,
      width: w,
      height: h,
      zoom: 0.88,
    })
    viewer.fov = 38
    viewer.autoRotate = true
    viewer.autoRotateSpeed = 0.55
    viewer.controls.enableRotate = false
    viewer.controls.enableZoom = false
    viewer.controls.enablePan = false
    viewer.playerObject.cape.visible = false
    viewer.playerObject.elytra.visible = false
    await viewer.loadSkin(props.skin, { model: props.model === 'slim' ? 'slim' : 'default' })
    if (token !== spinToken) {
      viewer.dispose?.()
      viewer = null
    }
  } catch {
    spinning.value = false
  }
}

function stopSpin() {
  spinToken++
  spinning.value = false
  viewer?.dispose?.()
  viewer = null
}

onBeforeUnmount(stopSpin)
</script>
