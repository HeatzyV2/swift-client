<template>
  <svg
    class="sw-mascot"
    :class="{ 'is-running': pose === 'run' }"
    :viewBox="`${pose === 'run' ? -11 : 0} 0 ${MASCOT_W + (pose === 'run' ? 11 : 0)} ${MASCOT_H}`"
    shape-rendering="crispEdges"
    role="img"
    aria-label="Zip"
  >
    <!-- Speed lines trail behind a running Zip -->
    <g v-if="pose === 'run'" class="sw-mascot-lines">
      <rect x="-11" y="8" width="8" height="1" fill="var(--sw-accent)" />
      <rect x="-8" y="12" width="9" height="1" fill="color-mix(in srgb, var(--sw-accent) 45%, #ffffff)" />
      <rect x="-11" y="16" width="7" height="1" fill="var(--sw-accent)" />
      <rect x="-6" y="20" width="5" height="1" fill="color-mix(in srgb, var(--sw-accent) 45%, #ffffff)" />
    </g>

    <g v-if="pose === 'run'" class="sw-mascot-body">
      <g class="sw-frame-a"><rect v-for="(r, i) in runA" :key="i" :x="r.x" :y="r.y" :width="r.w" height="1" :fill="r.c" /></g>
      <g class="sw-frame-b"><rect v-for="(r, i) in runB" :key="i" :x="r.x" :y="r.y" :width="r.w" height="1" :fill="r.c" /></g>
    </g>
    <g v-else class="sw-mascot-body sw-mascot-idle">
      <rect v-for="(r, i) in (pose === 'sleep' || pose === 'blink' ? sleep : idle)" :key="i" :x="r.x" :y="r.y" :width="r.w" height="1" :fill="r.c" />
    </g>
  </svg>
</template>

<script setup lang="ts">
import { MASCOT_FRAMES, MASCOT_H, MASCOT_W, frameRuns } from '~/utils/mascot'

withDefaults(defineProps<{ pose?: 'run' | 'idle' | 'sleep' | 'blink' }>(), { pose: 'idle' })

const runA = frameRuns(MASCOT_FRAMES.runA)
const runB = frameRuns(MASCOT_FRAMES.runB)
const idle = frameRuns(MASCOT_FRAMES.idle)
const sleep = frameRuns(MASCOT_FRAMES.sleep)
</script>

<style scoped>
.sw-mascot {
  display: block;
  overflow: visible;
  image-rendering: pixelated;
}
/* Two frames swap in place, four times a second: a pixel-art run cycle */
.is-running .sw-frame-b {
  visibility: hidden;
}
.is-running .sw-frame-a {
  animation: sw-frame-a 0.32s steps(1, end) infinite;
}
.is-running .sw-frame-b {
  animation: sw-frame-b 0.32s steps(1, end) infinite;
}
.is-running .sw-mascot-body {
  animation: sw-run-bob 0.32s steps(1, end) infinite;
}
.is-running .sw-mascot-lines {
  animation: sw-lines 0.4s steps(3, end) infinite;
}
@keyframes sw-frame-a {
  0% { visibility: visible; }
  50% { visibility: hidden; }
}
@keyframes sw-frame-b {
  0% { visibility: hidden; }
  50% { visibility: visible; }
}
@keyframes sw-run-bob {
  50% { transform: translateY(0.5px); }
}
@keyframes sw-lines {
  0% { transform: translateX(0); opacity: 1; }
  100% { transform: translateX(-3px); opacity: 0.35; }
}
.sw-mascot-idle {
  animation: sw-idle 1.2s steps(1, end) infinite;
}
@keyframes sw-idle {
  50% { transform: translateY(0.5px); }
}
</style>
