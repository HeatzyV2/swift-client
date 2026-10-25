<template>
  <!-- The player standing in the lobby: alive, looking at the cursor, turnable with a drag -->
  <div ref="box" class="cursor-grab active:cursor-grabbing">
    <canvas ref="canvas" class="block size-full" :class="ready ? 'sw-stage-in' : 'opacity-0'" />
  </div>
</template>

<script setup lang="ts">
import type { SkinSource } from '~/composables/usePlayerSkin'

const props = defineProps<{ skin: SkinSource | null }>()

const box = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const ready = ref(false)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let viewer: any = null
let resize: ResizeObserver | null = null
/** Where the cursor is, -1..1 on each axis, relative to the player. */
const look = { x: 0, y: 0 }

const BASE_TURN = -0.45

function onPointer(e: PointerEvent) {
  const el = box.value
  if (!el) return
  const r = el.getBoundingClientRect()
  look.x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2)))
  look.y = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height * 0.25)) / (window.innerHeight / 2)))
}

function onVisibility() {
  if (viewer) viewer.renderPaused = document.hidden
}

onMounted(async () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const { SkinViewer, PlayerAnimation } = await import('skinview3d')
  if (!canvas.value || !box.value) return

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t
  const smooth = (t: number) => t * t * (3 - 2 * t)

  /**
   * A lobby idle: breathing, a slow weight shift from one leg to the other, the head
   * following the cursor, and every few seconds a small emote (a wave or a look around).
   */
  class LobbyAnimation extends PlayerAnimation {
    head = { x: 0, y: 0 }
    protected animate(player: any): void {
      const t = this.progress
      const s = player.skin
      const breath = Math.sin(t * 2.1)
      const sway = Math.sin(t * 0.7)

      // Body: breathing and weight shift
      player.position.y = breath * 0.18
      player.rotation.z = sway * 0.025
      s.body.rotation.x = 0.02 + breath * 0.012

      // Legs: the weight moves from one to the other
      s.rightLeg.rotation.x = 0.04 + sway * 0.05
      s.leftLeg.rotation.x = -0.04 - sway * 0.05
      s.rightLeg.rotation.z = -0.05 - Math.max(0, sway) * 0.03
      s.leftLeg.rotation.z = 0.05 + Math.max(0, -sway) * 0.03

      // Arms hang loose and breathe
      s.leftArm.rotation.z = 0.09 + breath * 0.03
      s.leftArm.rotation.x = 0.06 + Math.sin(t * 1.3) * 0.04

      // Emote cycle: 9 s, a wave at 3–5 s, a look around at 7–8.5 s
      const cycle = t % 9
      let wave = 0
      if (cycle > 3 && cycle < 5) wave = smooth(Math.min(1, (cycle - 3) / 0.35, (5 - cycle) / 0.35))
      s.rightArm.rotation.z = lerp(-0.09 - breath * 0.03, -2.75, wave) + wave * Math.sin(t * 11) * 0.28
      s.rightArm.rotation.x = lerp(-0.06 + Math.sin(t * 1.3 + 1) * 0.04, 0, wave)

      let glance = 0
      if (cycle > 7 && cycle < 8.5) glance = Math.sin(((cycle - 7) / 1.5) * Math.PI)

      // Head: eases toward the cursor, plus the glance
      const targetY = look.x * 0.7 - BASE_TURN * 0.6 + glance * 0.6
      const targetX = look.y * 0.35 - 0.05 + breath * 0.015
      this.head.y = lerp(this.head.y, targetY, 0.08)
      this.head.x = lerp(this.head.x, targetX, 0.08)
      s.head.rotation.y = this.head.y
      s.head.rotation.x = this.head.x
    }
  }

  const { width, height } = box.value.getBoundingClientRect()
  viewer = new SkinViewer({
    canvas: canvas.value,
    width: Math.max(1, width),
    height: Math.max(1, height),
    pixelRatio: 'match-device',
    fov: 30,
    zoom: 0.88,
    renderPaused: document.hidden,
  })
  viewer.playerObject.cape.visible = false
  viewer.playerObject.elytra.visible = false
  viewer.playerObject.rotation.y = BASE_TURN
  viewer.globalLight.intensity = 3
  viewer.cameraLight.intensity = 0.6

  // Turn the player with a drag, around the vertical axis only; it settles back on release
  viewer.controls.enableZoom = false
  viewer.controls.enablePan = false
  viewer.controls.enableRotate = true
  viewer.controls.minPolarAngle = Math.PI / 2
  viewer.controls.maxPolarAngle = Math.PI / 2
  viewer.controls.enableDamping = true
  viewer.controls.rotateSpeed = 0.6

  if (!reduceMotion) viewer.animation = new LobbyAnimation()

  resize = new ResizeObserver(([entry]) => {
    const r = entry!.contentRect
    if (r.width && r.height) viewer?.setSize(r.width, r.height)
  })
  resize.observe(box.value)

  window.addEventListener('pointermove', onPointer, { passive: true })
  document.addEventListener('visibilitychange', onVisibility)

  watch(() => props.skin, async (s) => {
    if (!viewer || !s) return
    await viewer.loadSkin(s.src, { model: s.model === 'slim' ? 'slim' : 'default' })
    ready.value = true
  }, { immediate: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointer)
  document.removeEventListener('visibilitychange', onVisibility)
  resize?.disconnect()
  viewer?.dispose()
  viewer = null
})
</script>

<style scoped>
.sw-stage-in {
  animation: sw-stage-in 500ms var(--ease-swift) both;
}
@keyframes sw-stage-in {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: none; }
}
</style>
