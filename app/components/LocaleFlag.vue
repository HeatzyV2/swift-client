<template>
  <span class="inline-flex size-8 shrink-0 overflow-hidden rounded-full ring-1 ring-white/10" aria-hidden="true">
    <svg viewBox="0 0 32 32" class="size-full" xmlns="http://www.w3.org/2000/svg">
      <!-- United Kingdom -->
      <template v-if="code === 'en'">
        <rect width="32" height="32" fill="#012169" />
        <path d="M0 0 L32 32 M32 0 L0 32" stroke="#fff" stroke-width="6.5" />
        <path d="M0 0 L32 32 M32 0 L0 32" stroke="#C8102E" stroke-width="2.5" />
        <path d="M16 0 V32 M0 16 H32" stroke="#fff" stroke-width="10" />
        <path d="M16 0 V32 M0 16 H32" stroke="#C8102E" stroke-width="6" />
      </template>

      <!-- France -->
      <template v-else-if="code === 'fr'">
        <rect width="10.67" height="32" fill="#002395" />
        <rect x="10.67" width="10.66" height="32" fill="#fff" />
        <rect x="21.33" width="10.67" height="32" fill="#ED2939" />
      </template>

      <!-- Germany -->
      <template v-else-if="code === 'de'">
        <rect width="32" height="10.67" fill="#000" />
        <rect y="10.67" width="32" height="10.66" fill="#D00" />
        <rect y="21.33" width="32" height="10.67" fill="#FFCE00" />
      </template>

      <!-- Spain -->
      <template v-else-if="code === 'es'">
        <rect width="32" height="32" fill="#AA151B" />
        <rect y="8" width="32" height="16" fill="#F1BF00" />
      </template>

      <!-- Poland -->
      <template v-else-if="code === 'pl'">
        <rect width="32" height="16" fill="#fff" />
        <rect y="16" width="32" height="16" fill="#DC143C" />
      </template>

      <!-- Russia -->
      <template v-else-if="code === 'ru'">
        <rect width="32" height="10.67" fill="#fff" />
        <rect y="10.67" width="32" height="10.66" fill="#0039A6" />
        <rect y="21.33" width="32" height="10.67" fill="#D52B1E" />
      </template>

      <!-- China -->
      <template v-else-if="code === 'zh'">
        <rect width="32" height="32" fill="#DE2910" />
        <polygon points="8,5 9.2,8.6 13,8.6 10,10.8 11.1,14.4 8,12.2 4.9,14.4 6,10.8 3,8.6 6.8,8.6" fill="#FFDE00" />
        <polygon points="15.5,3.5 16,5 17.5,5 16.3,6 16.8,7.5 15.5,6.6 14.2,7.5 14.7,6 13.5,5 15,5" fill="#FFDE00" />
        <polygon points="18.5,6.5 19,8 20.5,8 19.3,9 19.8,10.5 18.5,9.6 17.2,10.5 17.7,9 16.5,8 18,8" fill="#FFDE00" />
        <polygon points="18.5,11.5 19,13 20.5,13 19.3,14 19.8,15.5 18.5,14.6 17.2,15.5 17.7,14 16.5,13 18,13" fill="#FFDE00" />
        <polygon points="15.5,14.5 16,16 17.5,16 16.3,17 16.8,18.5 15.5,17.6 14.2,18.5 14.7,17 13.5,16 15,16" fill="#FFDE00" />
      </template>

      <template v-else>
        <rect width="32" height="32" fill="#333" />
      </template>
    </svg>
  </span>
</template>

<script setup lang="ts">
defineProps<{ code: string }>()
</script>
