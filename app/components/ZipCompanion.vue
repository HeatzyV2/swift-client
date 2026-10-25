<template>
  <div
    v-if="enabled"
    class="pointer-events-none relative flex justify-center pt-2 [@media(max-height:700px)]:hidden"
  >
    <button
      type="button"
      class="pointer-events-auto relative shrink-0 cursor-pointer select-none"
      :aria-label="$t('swiftx.zip.tip5')"
      @click="nextTip"
    >
      <BrandMascot :pose="pose" class="h-[52px] w-auto" />
    </button>

    <Transition name="sw-pop-bubble">
      <p
        v-if="bubble"
        class="sw-block pointer-events-none absolute bottom-2 left-full z-[55] ml-1 w-[200px] px-3 py-2 text-left text-[13px] font-semibold leading-snug text-highlighted"
      >
        {{ bubble }}
      </p>
    </Transition>
  </div>
</template>

<script setup lang="ts">
const { enabled } = useZipPrefs()
const { t } = useI18n()
const ac = useActivityCenter()

const SLEEP_AFTER_MS = 60_000
const TIPS = ['tip1', 'tip2', 'tip3', 'tip4'] as const

const asleep = ref(false)
const blinking = ref(false)
const tip = ref<string | null>(null)
let tipIndex = 0

const busyInstalling = computed(() => ac.list.value.some(a => a.kind === 'install'))
const gameRunning = computed(() => ac.list.value.some(a => a.kind === 'running'))

const pose = computed<'idle' | 'blink' | 'sleep'>(() => (asleep.value ? 'sleep' : blinking.value ? 'blink' : 'idle'))

const bubble = computed(() => {
  if (asleep.value) return t('swiftx.zip.sleep')
  if (busyInstalling.value) return t('swiftx.zip.installing')
  if (tip.value) return tip.value
  return null
})

let sleepTimer: ReturnType<typeof setTimeout> | null = null
let tipTimer: ReturnType<typeof setTimeout> | null = null
let blinkTimer: ReturnType<typeof setTimeout> | null = null
let rotateTimer: ReturnType<typeof setInterval> | null = null

function showTip(text: string, ms = 6500) {
  tip.value = text
  if (tipTimer) clearTimeout(tipTimer)
  tipTimer = setTimeout(() => { tip.value = null }, ms)
}

function nextTip() {
  asleep.value = false
  showTip(t(`swiftx.zip.${TIPS[tipIndex % TIPS.length]}`))
  tipIndex++
}

function activity() {
  const wasAsleep = asleep.value
  asleep.value = false
  if (sleepTimer) clearTimeout(sleepTimer)
  sleepTimer = setTimeout(() => { asleep.value = true }, SLEEP_AFTER_MS)
  if (wasAsleep) showTip(t('swiftx.zip.hello'), 3000)
}

function scheduleBlink() {
  blinkTimer = setTimeout(() => {
    if (!asleep.value) {
      blinking.value = true
      setTimeout(() => { blinking.value = false }, 140)
    }
    scheduleBlink()
  }, 2800 + Math.random() * 3200)
}

// Say something when the game is up
watch(gameRunning, (up) => {
  if (up) showTip(t('swiftx.zip.playing'), 5000)
})

onMounted(() => {
  window.addEventListener('mousemove', activity, { passive: true })
  window.addEventListener('keydown', activity)
  activity()
  scheduleBlink()
  // A tip now and then, never while asleep
  showTip(t('swiftx.zip.hello'), 4000)
  rotateTimer = setInterval(() => {
    if (!asleep.value && !tip.value) nextTip()
  }, 90_000)
})

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', activity)
  window.removeEventListener('keydown', activity)
  for (const timer of [sleepTimer, tipTimer, blinkTimer]) if (timer) clearTimeout(timer)
  if (rotateTimer) clearInterval(rotateTimer)
})
</script>

<style scoped>
.sw-pop-bubble-enter-active {
  transition: opacity 180ms var(--ease-swift), transform 180ms var(--ease-swift);
}
.sw-pop-bubble-leave-active {
  transition: opacity 140ms var(--ease-swift);
}
.sw-pop-bubble-enter-from {
  opacity: 0;
  transform: translateY(6px) scale(0.94);
}
.sw-pop-bubble-leave-to {
  opacity: 0;
}
</style>
