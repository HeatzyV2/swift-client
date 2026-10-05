/**
 * "Zip", the Swift mascot: a little speedster with a big head, a lightning-bolt helmet and bolt fins,
 * on a 24x26 pixel grid. Three frames: idle, and two run frames that alternate into a stride.
 *
 * Palette keys:  K ink · B blue · D dark blue · L light blue · S skin · W white · Y bolt yellow · P pink · O orange
 * Anything else ('.') is transparent.
 */
export const MASCOT_W = 24
export const MASCOT_H = 26

const IDLE = [
  '......KKKKKKKKKKKK......',
  '.....KBBBBBBBBBBBBK.....',
  '....KBBBBBBYYBBBBBBK....',
  '...KBBLLLLYYBBBBBBBBK...',
  '..KBBLLLBYYYBBBBBBBBBK..',
  '.YKBBBBBBYYBBBBBBBBBBKY.',
  'YYYBDDDDDDDDDDDDDDDDBYYY',
  '.YKBBBKSSSSSSSSSSKBBBKY.',
  'Y.KBBKWWWWSSSWWWWSKBBK.Y',
  '..KBKSWWKWSSSWWKWSSKBK..',
  '..KBKSWKKWSSSWKKWSSKBK..',
  '..KBKSWKKWSSSWKKWSSKBK..',
  '..KBKPPSSKSSSKSSPPSKBK..',
  '...KBKSSSSKKKSSSSSKBK...',
  '....KBKSSSPPSSSSSKBK....',
  '.....KBKKKKKKKKKKBK.....',
  '....KBKKKKKKKKKKKKBK....',
  '....KBBKBBBYYBBBKBBK....',
  '....KKKKBBBYBBBBKKKK....',
  '....KSSKBBYBBBBBKSSK....',
  '....KSSKKBBBBBBKKSSK....',
  '.....KKKBKKKKKKBKKK.....',
  '.......KKKKKKKKKK.......',
  '......KYYYYKKYYYYK......',
  '......KYYYYKKYYYYK......',
  '.......KKKK..KKKK.......',
]

const RUN_A = [
  '.......KKKKKKKKKKKK.....',
  '......KBBBBBBBBBBBBK....',
  '.....KBBBBBBYYBBBBBBK...',
  '....KBBLLLLYYBBBBBBBBK..',
  '...KBBLLLBYYYBBBBBBBBBK.',
  '..YKBBBBBBYYBBBBBBBBBBKY',
  '.YYYBDDDDDDDDDDDDDDDDBYY',
  '..YKBBBKSSSSSSSSSSKBBBKY',
  '.Y.KBBKWWWWSSSWWWWSKBBK.',
  '...KBKSWWWKSSSWWWKSSKBK.',
  '...KBKSWWKKSSSWWKKSSKBK.',
  '...KBKSWWKKSSSWWKKSSKBK.',
  '...KBKPPSSKSSSKSSPPSKBK.',
  '....KBKSSSSKKKSSSSSKBK..',
  '.....KBKSSSPPSSSSSKBKK..',
  'KKKKKKKBKKKKKKKKKKBKK...',
  'SSSKBBBKKKKKKKKKKKKK....',
  'SSSKBBBKKBBBYYBBBKBK....',
  'KKKKKKK.KBBBYBBBBKK.....',
  '.......KKBBYBBBBBK......',
  '......KBBKBBBBBBKKK.....',
  '....KKKKBBKKKKKKBKKKK...',
  '..KKKKBBKBK..KKBKYYYYK..',
  '.KYYYYKBKK.....KKYYYYK..',
  '.KYYYYKK.........KKKK...',
  '..KKKK..................',
]

const RUN_B = [
  '.......KKKKKKKKKKKK.....',
  '......KBBBBBBBBBBBBK....',
  '.....KBBBBBBYYBBBBBBK...',
  '....KBBLLLLYYBBBBBBBBK..',
  '...KBBLLLBYYYBBBBBBBBBK.',
  '..YKBBBBBBYYBBBBBBBBBBKY',
  '.YYYBDDDDDDDDDDDDDDDDBYY',
  '..YKBBBKSSSSSSSSSSKBBBKY',
  '.Y.KBBKWWWWSSSWWWWSKBBK.',
  '...KBKSWWWKSSSWWWKSSKBK.',
  '...KBKSWWKKSSSWWKKSSKBK.',
  '...KBKSWWKKSSSWWKKSSKBK.',
  '...KBKPPSSKSSSKSSPPSKBK.',
  '....KBKSSSSKKKSSSSSKBK..',
  '...KKKBKSSSPPSSSSSKBKKK.',
  '..KBBKKBKKKKKKKKKKBKSSSK',
  '..KBBK.KKKKKKKKKKKKKSSSK',
  '..KKKK..KBBBYYBBBKBBKKK.',
  '.KSSSK..KBBBYBBBBKKKKK..',
  '.KSSSK.KKBBYBBBBBK......',
  '..KKK..KBKBBBBBBKK......',
  '.......KBKKKKKKKBK......',
  '........KKBKYKBBBK......',
  '..........KKYKKKKK......',
  '............KKYYYYK.....',
  '..............KKKK......',
]

/** Closed eyes (blink, sleep): the two eye windows (cols 6-9 and 13-16, rows 8-11) become skin with one ink line. */
function closeEyes(frame: readonly string[]): string[] {
  return frame.map((row, y) => {
    if (y < 8 || y > 11) return row
    const cells = row.split('')
    for (const [from, to] of [[6, 9], [13, 16]] as const) {
      for (let x = from; x <= to; x++) cells[x] = y === 10 ? 'K' : 'S'
    }
    return cells.join('')
  })
}

export const MASCOT_FRAMES = { runA: RUN_A, runB: RUN_B, idle: IDLE, sleep: closeEyes(IDLE) } as const

export const MASCOT_COLORS: Record<string, string> = {
  K: '#000000',
  B: 'var(--sw-accent, #2e7cff)',
  D: 'color-mix(in srgb, var(--sw-accent, #2e7cff) 62%, #000000)',
  L: 'color-mix(in srgb, var(--sw-accent, #2e7cff) 45%, #ffffff)',
  S: '#ffd6b0',
  W: '#ffffff',
  Y: '#ffd23f',
  P: '#ff7896',
  O: '#ff9a1f',
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
