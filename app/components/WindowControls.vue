<template>
  <div v-if="showControls" class="flex h-full" style="-webkit-app-region: no-drag">
    <button class="sw-winbtn" :title="$t('window.minimize')" @click="appWindow.minimize()">
      <svg width="10" height="10" viewBox="0 0 10 10"><rect y="4.5" width="10" height="1" fill="currentColor" /></svg>
    </button>
    <button class="sw-winbtn" :title="isMaximized ? $t('window.restore') : $t('window.maximize')" @click="toggleMaximize">
      <svg v-if="isMaximized" width="10" height="10" viewBox="0 0 10 10">
        <path fill="none" stroke="currentColor" d="M2.5 2.5h5v5h-5z M2.5 .5h7v7" />
      </svg>
      <svg v-else width="10" height="10" viewBox="0 0 10 10">
        <rect x=".5" y=".5" width="9" height="9" fill="none" stroke="currentColor" />
      </svg>
    </button>
    <button class="sw-winbtn sw-winbtn-close" :title="$t('window.close')" @click="appWindow.close()">
      <svg width="10" height="10" viewBox="0 0 10 10">
        <path fill="none" stroke="currentColor" stroke-width="1.1" d="M1 1l8 8M9 1L1 9" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { getCurrentWindow } from '@tauri-apps/api/window'

const { platform, ready } = usePlatform()

const isMaximized = ref(false)
const appWindow = getCurrentWindow()

// macOS runs with `titleBarStyle: Overlay` (see tauri.macos.conf.json) and draws
// its own traffic lights.
const showControls = computed(() => platform.value === 'windows' || platform.value === 'linux')

async function toggleMaximize() {
  if (isMaximized.value) await appWindow.unmaximize()
  else await appWindow.maximize()
}

let unlistenResize: (() => void) | null = null

onMounted(async () => {
  await ready
  isMaximized.value = await appWindow.isMaximized()
  unlistenResize = await appWindow.onResized(async () => {
    isMaximized.value = await appWindow.isMaximized()
  })
})

onUnmounted(() => unlistenResize?.())
</script>

<style scoped>
.sw-winbtn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 100%;
  color: var(--ui-text-muted);
  transition: background-color 100ms, color 100ms;
}
.sw-winbtn:hover {
  background: var(--sw-surface-3);
  color: var(--ui-text-highlighted);
}
.sw-winbtn-close:hover {
  background: #d93a3f;
  color: #fff;
}
</style>
