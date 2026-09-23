import type { Instance } from '~/types/launcher'

/** Asks before deleting an instance; `RemoveInstanceModal` does the rest. */
export const useConfirmRemoveInstance = () => {
  const target = useState<Pick<Instance, 'id' | 'name'> | null>('confirm-remove-instance', () => null)
  const request = (instance: Pick<Instance, 'id' | 'name'>) => { target.value = instance }
  const cancel = () => { target.value = null }
  return { target, request, cancel }
}
