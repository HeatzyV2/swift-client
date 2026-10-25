<template>
  <!-- One choice among a few, as cards side by side -->
  <div class="grid gap-2.5" :style="{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }" role="radiogroup">
    <button
      v-for="item in items"
      :key="item.value"
      type="button"
      role="radio"
      class="sw-option"
      :class="{ 'is-active': modelValue === item.value }"
      :aria-checked="modelValue === item.value"
      :disabled="disabled"
      @click="emit('update:modelValue', item.value)"
    >
      <span class="flex items-center justify-between gap-2">
        <UIcon :name="item.icon" class="size-5" :class="modelValue === item.value ? 'text-primary' : 'text-dimmed'" />
        <span class="sw-option-dot" />
      </span>
      <span class="mt-3 block text-[13.5px] font-semibold text-highlighted">{{ item.label }}</span>
      <span v-if="item.description" class="mt-0.5 block text-[12px] leading-snug text-muted">{{ item.description }}</span>
    </button>
  </div>
</template>

<script setup lang="ts" generic="T extends string">
defineProps<{
  modelValue: T
  items: { value: T, label: string, icon: string, description?: string }[]
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: T] }>()
</script>
