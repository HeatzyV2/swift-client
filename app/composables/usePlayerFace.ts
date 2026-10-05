/** The active account's head as a 64×64 data URL, or null while there is no real skin (never Steve/Alex). */
export const usePlayerFace = () => {
  const { skin, isDefault } = usePlayerSkin()
  const face = ref<string | null>(null)
  watch([skin, isDefault], async ([s, fallback]) => {
    face.value = s && !fallback ? await skinFace(s.src).catch(() => null) : null
  }, { immediate: true })
  return face
}
