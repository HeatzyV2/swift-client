// Generates Swift Client's built-in artwork (hero backdrop, news and feature
// illustrations) as small SVG files in public/art. Everything is original and
// procedural: blocky terrain layers, a pixel moon, stars. Run with
// `node scripts/generate-art.mjs` after changing a palette below.
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..', 'public', 'art')
fs.mkdirSync(OUT, { recursive: true })

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

// Smooth value noise sampled on a block grid, so every edge is a staircase.
function terrain(rand, { width, block, base, amp, octaves = 4 }) {
  const cols = Math.ceil(width / block) + 1
  const points = Array.from({ length: cols + 8 }, () => rand())
  const heights = []
  for (let c = 0; c < cols; c++) {
    let h = 0
    let a = 1
    let norm = 0
    for (let o = 0; o < octaves; o++) {
      const step = 2 ** (octaves - o)
      const i = Math.floor(c / step)
      const t = (c % step) / step
      const s = t * t * (3 - 2 * t)
      h += a * (points[i % points.length] * (1 - s) + points[(i + 1) % points.length] * s)
      norm += a
      a /= 2
    }
    const jitter = rand() < 0.3 ? (rand() < 0.5 ? -1 : 1) * block : 0
    heights.push(Math.round((base - (h / norm) * amp) / block) * block + jitter)
  }
  return heights
}

function stepPath(heights, block, bottom) {
  let d = `M0 ${bottom} L0 ${heights[0]}`
  heights.forEach((y, i) => {
    d += ` L${i * block} ${y} L${(i + 1) * block} ${y}`
  })
  return `${d} L${heights.length * block} ${bottom} Z`
}

function grassTops(heights, block, color, depth) {
  return heights.map((y, i) => `<rect x="${i * block}" y="${y}" width="${block}" height="${depth}" fill="${color}"/>`).join('')
}

function stars(rand, width, height, count, color) {
  let out = ''
  for (let i = 0; i < count; i++) {
    const size = rand() < 0.15 ? 4 : 2
    out += `<rect x="${Math.round(rand() * width)}" y="${Math.round(rand() * height)}" width="${size}" height="${size}" fill="${color}" opacity="${(0.25 + rand() * 0.6).toFixed(2)}"/>`
  }
  return out
}

function trees(rand, heights, block, count, trunk, leaves) {
  let out = ''
  for (let i = 0; i < count; i++) {
    const col = 2 + Math.floor(rand() * (heights.length - 4))
    const x = col * block
    const y = heights[col]
    const h = block * (3 + Math.floor(rand() * 2))
    out += `<rect x="${x + block / 3}" y="${y - h}" width="${block / 3}" height="${h}" fill="${trunk}"/>`
    out += `<rect x="${x - block}" y="${y - h - block}" width="${block * 3}" height="${block * 2}" fill="${leaves}"/>`
    out += `<rect x="${x - block / 2}" y="${y - h - block * 2}" width="${block * 2}" height="${block}" fill="${leaves}"/>`
  }
  return out
}

function particles(rand, width, height, count, color) {
  let out = ''
  for (let i = 0; i < count; i++) {
    const s = 3 + Math.round(rand() * 5)
    out += `<rect x="${Math.round(rand() * width)}" y="${Math.round(height * 0.2 + rand() * height * 0.6)}" width="${s}" height="${s}" fill="${color}" opacity="${(0.15 + rand() * 0.35).toFixed(2)}"/>`
  }
  return out
}

function scene({ width, height, seed, sky, moon, layers, starColor, particleColor, extra = '' }) {
  const rand = rng(seed)
  const defs = `
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      ${sky.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${moon.glow}" stop-opacity="0.35"/>
      <stop offset="1" stop-color="${moon.glow}" stop-opacity="0"/>
    </radialGradient>`
  let body = `<rect width="${width}" height="${height}" fill="url(#sky)"/>`
  body += stars(rand, width, height * 0.55, Math.round(width / 12), starColor)
  if (moon.size) {
    const { x, y, size } = moon
    body += `<circle cx="${x + size / 2}" cy="${y + size / 2}" r="${size * 2.6}" fill="url(#glow)"/>`
    body += `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${moon.color}"/>`
    body += `<rect x="${x + size * 0.18}" y="${y + size * 0.2}" width="${size * 0.22}" height="${size * 0.22}" fill="${moon.shade}"/>`
    body += `<rect x="${x + size * 0.58}" y="${y + size * 0.55}" width="${size * 0.18}" height="${size * 0.18}" fill="${moon.shade}"/>`
  }
  body += extra
  for (const layer of layers) {
    const heights = terrain(rand, { width, block: layer.block, base: layer.base * height, amp: layer.amp * height })
    body += `<path d="${stepPath(heights, layer.block, height)}" fill="${layer.fill}"/>`
    if (layer.grass) body += grassTops(heights, layer.block, layer.grass, Math.round(layer.block / 3))
    if (layer.trees) body += trees(rand, heights, layer.block, layer.trees, layer.trunk, layer.leaves)
  }
  body += particles(rand, width, height, Math.round(width / 60), particleColor)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges"><defs>${defs}</defs>${body}</svg>\n`
}

const NIGHT = {
  sky: [[0, '#0a1230'], [0.55, '#10244a'], [1, '#0b1322']],
  moon: { color: '#dce6ff', shade: '#b8c7ee', glow: '#5b8cff' },
  starColor: '#b9ccff',
  particleColor: '#8fb4ff',
}

function write(name, svg) {
  fs.writeFileSync(path.join(OUT, name), svg)
  console.log('wrote', name, `${(svg.length / 1024).toFixed(1)} KB`)
}

// Hero backdrop: wide, calm on the left where text sits.
write('hero-default.svg', scene({
  width: 1920, height: 1080, seed: 7, ...NIGHT,
  moon: { ...NIGHT.moon, x: 1380, y: 150, size: 96 },
  layers: [
    { block: 40, base: 0.62, amp: 0.42, fill: '#142447' },
    { block: 40, base: 0.78, amp: 0.3, fill: '#111d36', grass: '#1a3152' },
    { block: 48, base: 0.94, amp: 0.2, fill: '#0b1322', grass: '#1d4a3a', trees: 6, trunk: '#0a111d', leaves: '#0f2a22' },
  ],
}))

// Feature card: modpacks — dusk palette with a large block cluster.
const blocks = [[0, 0], [1, 0], [0, 1], [1, 1], [2, 1], [1, 2]].map(([cx, cy]) =>
  `<rect x="${470 + cx * 70}" y="${140 + cy * 70}" width="64" height="64" fill="#2e7cff" opacity="${0.35 + (cx + cy) * 0.12}"/>`).join('')
write('feature-modpacks.svg', scene({
  width: 800, height: 520, seed: 21,
  sky: [[0, '#0e1a3a'], [1, '#101626']],
  moon: { size: 0, glow: '#2e7cff' },
  starColor: '#9fb8ff', particleColor: '#5aa0ff',
  extra: blocks,
  layers: [
    { block: 32, base: 0.78, amp: 0.16, fill: '#132039', grass: '#1c3558' },
    { block: 40, base: 0.92, amp: 0.1, fill: '#0b1220', grass: '#1a3f33' },
  ],
}))

// News illustrations.
const mark = (x, y, s, color) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><path d="M42.5 23.5V15.5H21.5V32H42.5V48.5H21.5V40.5" transform="translate(6.8 0) skewX(-12)" fill="none" stroke="${color}" stroke-width="9"/></g>`

write('news-release.svg', scene({
  width: 800, height: 450, seed: 3, ...NIGHT,
  moon: { size: 0, glow: '#2e7cff' },
  extra: `<circle cx="400" cy="190" r="170" fill="url(#glow)"/>${mark(310, 95, 2.8, '#2e7cff')}`,
  layers: [{ block: 32, base: 0.86, amp: 0.12, fill: '#0c1424', grass: '#1c3558' }],
}))

write('news-modrinth.svg', scene({
  width: 800, height: 450, seed: 11,
  sky: [[0, '#0b2a24'], [1, '#0b1418']],
  moon: { x: 560, y: 70, size: 64, color: '#d8f5e6', shade: '#b0dcc6', glow: '#1bd96a' },
  starColor: '#bdf2d4', particleColor: '#1bd96a',
  layers: [
    { block: 32, base: 0.7, amp: 0.2, fill: '#0f2a26', grass: '#15503b' },
    { block: 40, base: 0.9, amp: 0.1, fill: '#091513', grass: '#16603f', trees: 3, trunk: '#07100e', leaves: '#0d2a20' },
  ],
}))

write('news-privacy.svg', scene({
  width: 800, height: 450, seed: 5,
  sky: [[0, '#1a1236'], [1, '#0d0c18']],
  moon: { x: 140, y: 80, size: 56, color: '#e6dcff', shade: '#c4b4f0', glow: '#8b6cff' },
  starColor: '#d2c6ff', particleColor: '#a48bff',
  layers: [
    { block: 32, base: 0.74, amp: 0.18, fill: '#1c1636', grass: '#2b2352' },
    { block: 40, base: 0.9, amp: 0.1, fill: '#0e0b1a', grass: '#2a2150' },
  ],
}))
