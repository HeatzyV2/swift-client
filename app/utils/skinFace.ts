const faces = new Map<string, Promise<string>>()

/** Crops the face (plus the hat layer) out of a skin texture, as a 64×64 PNG data URL. */
export function skinFace(skinSrc: string): Promise<string> {
  const cached = faces.get(skinSrc)
  if (cached) return cached
  const task = new Promise<string>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 64
      canvas.height = 64
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('no 2d context'))
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(img, 8, 8, 8, 8, 0, 0, 64, 64)
      ctx.drawImage(img, 40, 8, 8, 8, 0, 0, 64, 64)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error('could not read skin'))
    img.src = skinSrc
  })
  faces.set(skinSrc, task)
  return task
}
