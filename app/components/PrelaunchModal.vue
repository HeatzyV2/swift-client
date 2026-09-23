<template>
  <UModal :open="!!flow.pending.value" :title="$t('prelaunch.title')" :ui="{ content: 'max-w-md' }" @update:open="(v: boolean) => { if (!v) flow.cancel() }">
    <template #body>
      <ul class="space-y-2 text-sm">
        <li v-for="(w, i) in flow.pending.value?.warnings ?? []" :key="i" class="flex items-start gap-2.5 text-toned">
          <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-4 shrink-0 text-warning" />
          <span>{{ w }}</span>
        </li>
      </ul>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton variant="ghost" color="neutral" :label="$t('common.cancel')" @click="flow.cancel()" />
        <UButton color="warning" variant="soft" :label="$t('prelaunch.launchAnyway')" @click="flow.confirm()" />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const flow = useLaunchFlow()
</script>
