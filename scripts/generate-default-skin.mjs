// Draws Swift Client's fallback skin (public/skins/default.png): a plain,
// original 64×64 classic-model skin — dark hoodie with a blue zip — shown only
// when there is no real skin to display. Run: node scripts/generate-default-skin.mjs
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const OUT = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..', 'public', 'skins', 'default.png')

const C = {
  skin: [214, 162, 124], skinShade: [192, 142, 106], hair: [44, 32, 26], hairLight: [60, 44, 34],
  eyeWhite: [240, 244, 250], eye: [34, 88, 210], mouth: [150, 92, 72],
  hoodie: [28, 36, 51], hoodieShade: [22, 28, 40], collar: [40, 50, 70], zip: [46, 124, 255],
  pants: [36, 42, 58], shoe: [214, 219, 228], sole: [120, 126, 138],
}

const W = 64
const px = new Uint8Array(W * W * 4)
const set = (x, y, [r, g, b]) => { const o = (y * W + x) * 4; px.set([r, g, b, 255], o) }

// Standard cuboid UV layout: paints each face through `color(face, x, y, w, h)`.
function cuboid(u, v, w, h, d, color) {
  const faces = {
    top: [u + d, v, w, d], bottom: [u + d + w, v, w, d],
    right: [u, v + d, d, h], front: [u + d, v + d, w, h],
    left: [u + d + w, v + d, d, h], back: [u + d + w + d, v + d, w, h],
  }
  for (const [face, [fx, fy, fw, fh]] of Object.entries(faces)) {
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) set(fx + x, fy + y, color(face, x, y, fw, fh))
  }
}

const head = (face, x, y) => {
  if (face === 'top' || face === 'back') return (x + y) % 5 === 0 ? C.hairLight : C.hair
  if (face === 'bottom') return C.skinShade
  if (face === 'front') {
    if (y === 0 || (y === 1 && (x < 2 || x > 5))) return C.hair
    if (y === 4 && (x === 1 || x === 6)) return C.eyeWhite
    if (y === 4 && (x === 2 || x === 5)) return C.eye
    if (y === 6 && (x === 3 || x === 4)) return C.mouth
    return C.skin
  }
  return y < 3 || (face === 'right' ? x < 2 : x > 5) && y < 5 ? C.hair : C.skin
}

const body = (face, x, y, w) => {
  if (face === 'top') return C.collar
  if (face === 'bottom') return C.hoodieShade
  if (face === 'front') {
    if (y === 0) return C.collar
    if (x === w / 2 - 1 || x === w / 2) return y < 10 ? C.zip : C.hoodie
    return y === 11 ? C.hoodieShade : C.hoodie
  }
  return y === 11 ? C.hoodieShade : C.hoodie
}

const arm = (face, _x, y) => {
  if (face === 'bottom') return C.skin
  if (face === 'top') return C.hoodie
  if (y >= 9) return y === 9 ? C.hoodieShade : C.skin
  return C.hoodie
}

const leg = (face, _x, y) => {
  if (face === 'top') return C.pants
  if (face === 'bottom') return C.sole
  if (y >= 10) return y === 11 ? C.sole : C.shoe
  return C.pants
}

cuboid(0, 0, 8, 8, 8, head)
cuboid(16, 16, 8, 12, 4, body)
cuboid(40, 16, 4, 12, 4, arm)
cuboid(32, 48, 4, 12, 4, arm)
cuboid(0, 16, 4, 12, 4, leg)
cuboid(16, 48, 4, 12, 4, leg)

function crc32(buf) {
  let crc = 0xffffffff
  for (const b of buf) {
    let c = (crc ^ b) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = (crc >>> 8) ^ c
  }
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
const raw = Buffer.alloc((W * 4 + 1) * W)
for (let y = 0; y < W; y++) Buffer.from(px.buffer, y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1)
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(W, 4); ihdr[8] = 8; ihdr[9] = 6
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]))
console.log('wrote', OUT)
