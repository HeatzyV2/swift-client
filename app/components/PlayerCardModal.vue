<template>
  <UModal v-model:open="cardOpen" :title="$t('swiftx.stats.cardTitle')" :ui="{ content: 'max-w-[680px]' }">
    <template #body>
      <canvas ref="canvas" class="block w-full [image-rendering:pixelated]" style="aspect-ratio: 16 / 9" />
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="soft" icon="i-lucide-copy" :label="$t('swiftx.stats.copy')" @click="copyImage" />
        <UButton icon="i-lucide-download" :label="$t('swiftx.stats.save')" @click="saveImage" />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'

const { cardOpen } = useCommandPalette()
const { t, locale } = useI18n()
const toast = useToast()
const accounts = useAccountStore()
const instances = useInstancesStore()
const { level, progress, badges, streak, stats, totalSeconds } = usePlayerProgress()
const face = usePlayerFace()

const canvas = ref<HTMLCanvasElement | null>(null)

const W = 960
const H = 540
const FONT = '"Pixelify Sans", "Inter", system-ui, sans-serif'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image'))
    img.src = src
  })
}

function block(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, side = '#0b1a44') {
  ctx.fillStyle = side
  ctx.fillRect(x, y + 8, w, h)
  ctx.fillStyle = '#000'
  ctx.fillRect(x - 4, y - 4, w + 8, h + 8)
  ctx.fillStyle = fill
  ctx.fillRect(x, y, w, h)
}

async function draw() {
  const cv = canvas.value
  if (!cv) return
  cv.width = W
  cv.height = H
  const ctx = cv.getContext('2d')
  if (!ctx) return
  ctx.imageSmoothingEnabled = false
  try {
    await document.fonts.load(`700 40px "Pixelify Sans"`)
  } catch { /* fall back to the system font */ }

  // Background and a faint pixel grid
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#10162a')
  bg.addColorStop(1, '#05060b')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = 'rgba(255,255,255,0.03)'
  for (let x = 0; x < W; x += 24) ctx.fillRect(x, 0, 1, H)
  for (let y = 0; y < H; y += 24) ctx.fillRect(0, y, W, 1)

  // Frame
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, 8)
  ctx.fillRect(0, H - 8, W, 8)
  ctx.fillRect(0, 0, 8, H)
  ctx.fillRect(W - 8, 0, 8, H)
  ctx.fillStyle = '#2e7cff'
  ctx.fillRect(8, 8, W - 16, 6)

  // Wordmark
  ctx.textBaseline = 'alphabetic'
  ctx.font = `700 34px ${FONT}`
  ctx.fillStyle = '#000'
  ctx.fillText('SWIFT CLIENT', 62, 62)
  ctx.fillStyle = '#fff'
  ctx.fillText('SWIFT', 58, 58)
  ctx.fillStyle = '#2e7cff'
  ctx.fillText('CLIENT', 58 + ctx.measureText('SWIFT ').width, 58)

  // Avatar: the head, big and sharp, in a sticker frame
  const ax = 70
  const ay = 120
  const size = 232
  block(ctx, ax, ay, size, size, '#1c1f24')
  ctx.strokeStyle = '#2e7cff'
  ctx.lineWidth = 6
  ctx.strokeRect(ax - 1, ay - 1, size + 2, size + 2)
  if (face.value) {
    try {
      ctx.drawImage(await loadImage(face.value), ax, ay, size, size)
    } catch { /* leave the plate empty */ }
  } else {
    ctx.fillStyle = '#9ba1ad'
    ctx.font = `700 120px ${FONT}`
    ctx.textAlign = 'center'
    ctx.fillText((accounts.activeAccount?.username ?? '?').charAt(0).toUpperCase(), ax + size / 2, ay + size / 2 + 42)
    ctx.textAlign = 'left'
  }

  // Name and level
  const tx = 350
  ctx.font = `700 64px ${FONT}`
  ctx.fillStyle = '#000'
  ctx.fillText(accounts.activeAccount?.username ?? t('account.signIn'), tx + 4, 178 + 4)
  ctx.fillStyle = '#fff'
  ctx.fillText(accounts.activeAccount?.username ?? t('account.signIn'), tx, 178)

  ctx.font = `700 30px ${FONT}`
  ctx.fillStyle = '#2e7cff'
  ctx.fillText(t('swiftx.stats.level', { n: level.value }).toUpperCase(), tx, 224)

  // XP bar (segmented)
  const bx = tx
  const by = 244
  const bw = 520
  const segs = 26
  ctx.fillStyle = '#000'
  ctx.fillRect(bx - 4, by - 4, bw + 8, 30)
  ctx.fillStyle = '#1a1f2b'
  ctx.fillRect(bx, by, bw, 22)
  const cell = (bw - (segs - 1) * 3) / segs
  const lit = Math.round(progress.value * segs)
  for (let i = 0; i < lit; i++) {
    ctx.fillStyle = '#2e7cff'
    ctx.fillRect(bx + i * (cell + 3), by, cell, 22)
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.fillRect(bx + i * (cell + 3), by, cell, 4)
  }

  // Stats
  const items: [string, string][] = [
    [t('instance.playtime'), formatPlaytime(totalSeconds.value, locale.value)],
    [t('nav.instances'), String(instances.instances.length)],
    [t('swiftx.stats.streak'), t('swiftx.stats.days', { n: streak.value })],
    [t('swiftx.stats.best'), stats.value.best === null ? t('swiftx.stats.none') : `${(stats.value.best / 1000).toFixed(1)} s`],
  ]
  items.forEach(([label, value], i) => {
    const sx = tx + (i % 2) * 270
    const sy = 296 + Math.floor(i / 2) * 78
    block(ctx, sx, sy, 250, 62, '#141925', '#000')
    ctx.font = `600 15px ${FONT}`
    ctx.fillStyle = '#7d8491'
    ctx.fillText(label.toUpperCase(), sx + 14, sy + 24)
    ctx.font = `700 30px ${FONT}`
    ctx.fillStyle = '#fff'
    ctx.fillText(value, sx + 14, sy + 52)
  })

  // Badges
  ctx.font = `700 22px ${FONT}`
  ctx.fillStyle = '#7d8491'
  ctx.fillText(t('swiftx.stats.badges').toUpperCase(), 70, 438)
  badges.value.forEach((b, i) => {
    const sx = 70 + i * 74
    block(ctx, sx, 454, 58, 50, b.earned ? '#1d2842' : '#0d1018', '#000')
    ctx.font = '28px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif'
    ctx.textAlign = 'center'
    ctx.globalAlpha = b.earned ? 1 : 0.22
    ctx.fillText(b.emoji, sx + 29, 489)
    ctx.globalAlpha = 1
    ctx.textAlign = 'left'
  })
}

watch(cardOpen, async (open) => {
  if (!open) return
  await nextTick()
  // The dialog mounts its body a tick later
  setTimeout(draw, 80)
})

function toBlob(): Promise<Blob | null> {
  return new Promise(resolve => canvas.value?.toBlob(resolve, 'image/png') ?? resolve(null))
}

async function copyImage() {
  try {
    const blob = await toBlob()
    if (!blob) return
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    toast.add({ title: t('swiftx.stats.copied'), icon: 'i-lucide-check', color: 'success' })
  } catch (e) {
    toast.add({ title: errorText(e), color: 'error' })
  }
}

async function saveImage() {
  try {
    const path = await save({ defaultPath: 'swift-player-card.png', filters: [{ name: 'PNG', extensions: ['png'] }] })
    if (!path || !canvas.value) return
    const data = canvas.value.toDataURL('image/png').split(',')[1] ?? ''
    await invoke('save_png', { path, dataBase64: data })
    toast.add({ title: t('swiftx.stats.saved'), icon: 'i-lucide-check', color: 'success' })
  } catch (e) {
    toast.add({ title: errorText(e), color: 'error' })
  }
}
</script>
