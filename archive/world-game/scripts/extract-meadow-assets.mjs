import sharp from 'sharp'
import fs from 'fs'

async function blobs(src, opts = {}) {
  const { minW = 8, minH = 8, maxW = 64, maxH = 64, minPixels = 30 } = opts
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const w = info.width
  const h = info.height
  const seen = new Uint8Array(w * h)
  const out = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (seen[i] || data[i * 4 + 3] < 20) continue
      let minX = x
      let maxX = x
      let minY = y
      let maxY = y
      let c = 0
      const st = [[x, y]]
      seen[i] = 1
      while (st.length) {
        const [cx, cy] = st.pop()
        c++
        minX = Math.min(minX, cx)
        maxX = Math.max(maxX, cx)
        minY = Math.min(minY, cy)
        maxY = Math.max(maxY, cy)
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = cx + dx
          const ny = cy + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const ni = ny * w + nx
          if (seen[ni] || data[ni * 4 + 3] < 20) continue
          seen[ni] = 1
          st.push([nx, ny])
        }
      }
      const bw = maxX - minX + 1
      const bh = maxY - minY + 1
      if (c >= minPixels && bw >= minW && bh >= minH && bw <= maxW && bh <= maxH) {
        out.push({ minX, minY, bw, bh, c })
      }
    }
  }
  out.sort((a, b) => b.c - a.c)
  return out
}

const dest = 'public/game/world/meadow'
fs.mkdirSync(dest, { recursive: true })

const hills = 'public/game/world/tiles/Hills.png'
await sharp(hills).png().toFile(`${dest}/_hills_full.png`)
await sharp('public/game/world/tiles/Grass.png').png().toFile(`${dest}/_grass_full.png`)

const gl = 'public/game/world/tiles/Grass_Tile_Layers.png'
const gm = await sharp(gl).metadata()
await sharp(gl).extract({ left: 0, top: 0, width: 176, height: 176 }).png().toFile(`${dest}/_layers_top.png`)
await sharp(gl)
  .extract({ left: 0, top: 176, width: 176, height: Math.min(176, gm.height - 176) })
  .png()
  .toFile(`${dest}/_layers_bot.png`)

const src = 'public/game/world/tiles/Grass.png'
const gb = await blobs(src, { minW: 20, minH: 20, maxW: 80, maxH: 80, minPixels: 200 })
console.log(
  'grass islands',
  gb.slice(0, 8).map((b) => `${b.bw}x${b.bh}@${b.minX},${b.minY}`),
)
for (let i = 0; i < Math.min(6, gb.length); i++) {
  const b = gb[i]
  await sharp(src)
    .extract({ left: b.minX, top: b.minY, width: b.bw, height: b.bh })
    .png()
    .toFile(`${dest}/island_${i}.png`)
}

const wood = '/Users/melissukaya/Desktop/Sprout Sorry pack/Early Access/Plant update 2/wood n shroms.png'
fs.copyFileSync(wood, 'public/game/world/props/wood_shrooms.png')
const wb = await blobs(wood, { minW: 8, minH: 8, maxW: 40, maxH: 40, minPixels: 25 })
console.log(
  'wood',
  wb.slice(0, 12).map((b) => `${b.bw}x${b.bh}@${b.minX},${b.minY}`),
)
for (let i = 0; i < Math.min(10, wb.length); i++) {
  const b = wb[i]
  await sharp(wood)
    .extract({ left: b.minX, top: b.minY, width: b.bw, height: b.bh })
    .png()
    .toFile(`${dest}/wood_${i}.png`)
}

for (const [from, to] of [
  ['tree_oak', 't_oak'],
  ['tree_pine', 't_pine'],
  ['tree_birch', 't_birch'],
  ['tree_round', 't_round'],
  ['tree_fruit', 't_fruit'],
  ['tree_slim', 't_slim'],
  ['pine_md', 't_pine_md'],
  ['pine_sm', 't_pine_sm'],
  ['bush_sm_a', 'bush_a'],
  ['bush_sm_b', 'bush_b'],
  ['stump_a', 'stump'],
  ['mushroom', 'mush'],
  ['sunflower', 'sunflower'],
  ['flowers', 'flowers'],
  ['flower_a', 'flower_a'],
  ['rock_md', 'rock'],
  ['rock_sm', 'rock_sm'],
  ['water_a', 'water_a'],
  ['water_b', 'water_b'],
  ['fence_h', 'fence_h'],
  ['fence_v', 'fence_v'],
]) {
  const p = `public/game/world/crops/${from}.png`
  if (fs.existsSync(p)) fs.copyFileSync(p, `${dest}/${to}.png`)
}

// Best light-green fill tile from Grass_Tile_Layers
let best = null
for (let ty = 0; ty <= gm.height - 16; ty += 8) {
  for (let tx = 0; tx <= gm.width - 16; tx += 8) {
    const { data: d } = await sharp(gl)
      .extract({ left: tx, top: ty, width: 16, height: 16 })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    let opaque = 0
    let sumG = 0
    let sumR = 0
    const samples = []
    for (let i = 0; i < 256; i++) {
      const a = d[i * 4 + 3]
      if (a < 200) continue
      opaque++
      sumR += d[i * 4]
      sumG += d[i * 4 + 1]
      samples.push(d[i * 4 + 1])
    }
    if (opaque < 250) continue
    const avgG = sumG / opaque
    const avgR = sumR / opaque
    if (avgG < avgR + 10) continue
    let varsum = 0
    for (const g of samples) varsum += Math.abs(g - avgG)
    const variance = varsum / samples.length
    if (variance > 0.5 && variance < 30) {
      const score = opaque * 2 + (avgG > 160 ? 50 : 0) - variance
      if (!best || score > best.score) best = { tx, ty, score, avgG, variance }
    }
  }
}
console.log('best fill', best)
if (best) {
  await sharp(gl)
    .extract({ left: best.tx, top: best.ty, width: 16, height: 16 })
    .png()
    .toFile(`${dest}/fill.png`)
  await sharp(gl)
    .extract({
      left: Math.min(best.tx + 16, gm.width - 16),
      top: best.ty,
      width: 16,
      height: 16,
    })
    .png()
    .toFile(`${dest}/fill_b.png`)
}

const hm = await sharp(hills).metadata()
console.log('hills', hm.width, hm.height)
for (let row = 0; row < hm.height / 16; row++) {
  await sharp(hills)
    .extract({ left: 0, top: row * 16, width: Math.min(176, hm.width), height: 16 })
    .png()
    .toFile(`${dest}/hrow_${row}.png`)
}

// Also extract 16x16 hill cells that look like cliff faces (have brown)
let cliffN = 0
for (let ty = 0; ty <= hm.height - 16; ty += 16) {
  for (let tx = 0; tx <= hm.width - 16; tx += 16) {
    const { data: d } = await sharp(hills)
      .extract({ left: tx, top: ty, width: 16, height: 16 })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    let opaque = 0
    let brown = 0
    let green = 0
    for (let i = 0; i < 256; i++) {
      const r = d[i * 4]
      const g = d[i * 4 + 1]
      const b = d[i * 4 + 2]
      const a = d[i * 4 + 3]
      if (a < 200) continue
      opaque++
      if (g > r + 15 && g > 100) green++
      if (r > 80 && r > g - 10 && r > b) brown++
    }
    if (opaque < 80) continue
    await sharp(hills)
      .extract({ left: tx, top: ty, width: 16, height: 16 })
      .png()
      .toFile(`${dest}/ht_${tx}_${ty}_g${green}_b${brown}.png`)
    cliffN++
  }
}
console.log('hill cells', cliffN)
console.log('done', fs.readdirSync(dest).length, 'files')
