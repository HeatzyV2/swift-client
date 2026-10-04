<template>
  <div v-if="active" :key="run" class="sw-dash" aria-hidden="true">
    <!-- Full-width speed streaks sweep through first -->
    <span class="sw-dash-streak" style="--y: 34%; --d: 0ms; --w: 46vw" />
    <span class="sw-dash-streak" style="--y: 46%; --d: 60ms; --w: 62vw" />
    <span class="sw-dash-streak" style="--y: 58%; --d: 30ms; --w: 38vw" />
    <span class="sw-dash-streak" style="--y: 70%; --d: 90ms; --w: 54vw" />

    <div class="sw-dash-runner">
      <BrandMascot pose="run" class="h-[132px] w-auto" />
    </div>

    <span class="sw-dash-go sw-sign-text">GO!</span>
  </div>
</template>

<script setup lang="ts">
const { run } = useLaunchDash()
const active = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

watch(run, () => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  active.value = false
  nextTick(() => { active.value = true })
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { active.value = false }, 1300)
})

onBeforeUnmount(() => { if (timer) clearTimeout(timer) })
</script>

<style scoped>
.sw-dash {
  position: fixed;
  inset: 0;
  z-index: 300;
  overflow: hidden;
  pointer-events: none;
}
.sw-dash-runner {
  position: absolute;
  top: calc(50% - 66px);
  left: 0;
  animation: sw-dash-run 900ms steps(22, end) both;
}
.sw-dash-streak {
  position: absolute;
  top: var(--y);
  left: 0;
  width: var(--w);
  height: 8px;
  background: var(--sw-accent);
  box-shadow: 0 0 0 3px var(--sw-ink);
  animation: sw-dash-streak 900ms steps(18, end) var(--d) both;
}
.sw-dash-go {
  position: absolute;
  top: 50%;
  left: 50%;
  translate: -50% -50%;
  font-size: 120px;
  font-weight: 700;
  line-height: 1;
  color: #ffffff;
  -webkit-text-stroke: 6px var(--sw-ink);
  paint-order: stroke fill;
  text-shadow: 8px 8px 0 var(--sw-accent);
  animation: sw-dash-go 1100ms steps(10, end) 250ms both;
}
@keyframes sw-dash-run {
  from { transform: translateX(-240px); }
  to { transform: translateX(calc(100vw + 60px)); }
}
@keyframes sw-dash-streak {
  0% { transform: translateX(-100%); opacity: 1; }
  70% { opacity: 1; }
  100% { transform: translateX(calc(100vw + 20px)); opacity: 0; }
}
@keyframes sw-dash-go {
  0% { opacity: 0; transform: scale(0.4); }
  25% { opacity: 1; transform: scale(1.15); }
  45% { transform: scale(1); }
  80% { opacity: 1; }
  100% { opacity: 0; transform: scale(1.1); }
}
</style>
