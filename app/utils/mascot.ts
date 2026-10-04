/**
 * "Zip", the Swift mascot: a blocky speedster in the spirit of the Flash, built
 * on a 16×18 pixel grid. Two run frames (legs swap) and one idle frame.
 *
 * Palette keys:  K ink · B blue · D dark blue · L light blue · S skin · W white · Y bolt yellow
 * Anything else ('.') is transparent.
 */
export const MASCOT_W = 16
export const MASCOT_H = 18

const HEAD = [
  '...KKKKKKKKK....',
  '..KBBBBBBBBBK...',
  '.YKBBLLBBBBBBK..',
  'YYKBBBBBBBBBBK..',
  '.YKSSSSSSSSSSK..',
  'Y.KSSWKSSWKSSK..',
  '..KSSSSSSSSSSK..',
  '...KKSSSSSSKK...',
]

const TORSO = [
  '...KBBBBBBBBK...',
  '..KBBBBYYBBBBK..',
  '..KBBBYYYBBBBK..',
  '..KBBBBBYYBBBK..',
  '...KDBBYYBBDK...',
]

const RUN_HEAD = [
  '.....KKKKKKKK...',
  '....KBBBBBBBBK..',
  '..Y.KBBLLBBBBBK.',
  '.YYKBBBBBBBBBBKY',
  '..Y.KSSSSSSSSSKY',
  '.Y..KSSWKSWKSSK.',
  '....KSSSSSSSSK..',
  '.....KKSSSSKK...',
]

/** Frame A: back arm swept behind, front leg reaches forward. */
const RUN_A = [
  ...RUN_HEAD,
  '....KBBBBBBBK...',
  '.KKKBBBBYYBBK...',
  'KBBBBBBYYYBBK...',
  '.KKKBBBBBYYBK...',
  '...KBBBYYBBDK...',
  '....KDBBBBBK....',
  '...KBBKKKBBK....',
  '..KBBK...KBBBK..',
  '.KBBK.....KKBBK.',
  '.KKK........KKK.',
]

/** Frame B: arms and legs swapped, so the two frames read as a stride. */
const RUN_B = [
  ...RUN_HEAD,
  '....KBBBBBBBK...',
  '....KBBBYYBBBKK.',
  '...KBBBYYYBBBBBK',
  '....KBBBBYYBBKK.',
  '...KBBBYYBBDK...',
  '....KDBBBBBK....',
  '....KBBKKBBK....',
  '...KBBK..KBBK...',
  '..KBBK....KBBK..',
  '..KKK......KKK..',
]

const IDLE = [
  ...HEAD,
  ...TORSO,
  '...KBBBKKBBBK...',
  '...KBBBK.KBBK...',
  '...KBBBK.KBBK...',
  '...KKKKK.KKKK...',
  '................',
]

export const MASCOT_FRAMES = { runA: RUN_A, runB: RUN_B, idle: IDLE } as const

export const MASCOT_COLORS: Record<string, string> = {
  K: '#000000',
  B: 'var(--sw-accent, #2e7cff)',
  D: 'color-mix(in srgb, var(--sw-accent, #2e7cff) 62%, #000000)',
  L: 'color-mix(in srgb, var(--sw-accent, #2e7cff) 45%, #ffffff)',
  S: '#f2c9a0',
  W: '#ffffff',
  Y: '#ffd23f',
}

export interface PixelRun { x: number, y: number, w: number, c: string }

/** Merges horizontal runs of one colour into single rects (fewer seams, smaller SVG). */
export function frameRuns(frame: readonly string[]): PixelRun[] {
  const runs: PixelRun[] = []
  frame.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const key = row[x]!
      if (key === '.' || !MASCOT_COLORS[key]) { x++; continue }
      let w = 1
      while (row[x + w] === key) w++
      runs.push({ x, y, w, c: MASCOT_COLORS[key]! })
      x += w
    }
  })
  return runs
}
