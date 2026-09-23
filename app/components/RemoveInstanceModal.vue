<template>
  <UModal
    :open="!!confirm.target.value"
    :title="$t('removeInstance.title')"
    :ui="{ content: 'max-w-md' }"
    @update:open="(v: boolean) => { if (!v) confirm.cancel() }"
  >
    <template #body>
      <p class="text-sm text-toned">
        {{ $t('removeInstance.body', { name: confirm.target.value?.name ?? '' }) }}
      </p>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton variant="ghost" color="neutral" :label="$t('common.cancel')" @click="confirm.cancel()" />
        <UButton color="error" icon="i-lucide-trash-2" :loading="removing" :label="$t('removeInstance.confirm')" @click="remove" />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const confirm = useConfirmRemoveInstance()
const instances = useInstancesStore()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { t } = useI18n()

const removing = ref(false)

async function remove() {
  const target = confirm.target.value
  if (!target) return
  removing.value = true
  try {
    await instances.remove(target.id)
    if (route.params.id === target.id) await router.push('/instances')
    toast.add({ title: t('removeInstance.done', { name: target.name }), color: 'neutral', icon: 'i-lucide-trash-2' })
    confirm.cancel()
  } catch (e) {
    toast.add({ title: errorText(e), color: 'error' })
  } finally {
    removing.value = false
  }
}
</script>
