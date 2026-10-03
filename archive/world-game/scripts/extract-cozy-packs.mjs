import sharp from 'sharp'
import fs from 'fs'

async function extractBlobs(src, outDir, prefix, opts = {}) {
  const { minW = 6, minH = 6, maxW = 120, maxH = 120, minPixels = 20 } = opts
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const w = info.width
  const h = info.height
  const seen = new Uint8Array(w * h)
  const blobs = []
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
        blobs.push({ minX, minY, bw, bh, c })
      }
    }
  }
  blobs.sort((a, b) => b.c - a.c || a.minX - b.minX)
  fs.mkdirSync(outDir, { recursive: true })
  const saved = []
  for (let i = 0; i < blobs.length; i++) {
    const b = blobs[i]
    const left = Math.max(0, b.minX)
    const top = Math.max(0, b.minY)
    const name = `${prefix}_${String(i).padStart(2, '0')}_${b.bw}x${b.bh}.png`
    await sharp(src)
      .extract({ left, top, width: b.bw, height: b.bh })
      .png()
      .toFile(`${outDir}/${name}`)
    saved.push({ name, ...b, left, top })
  }
  return saved
}

const townSrc = 'public/game/town/_sheet.png'
const intSrc = 'public/game/interior/_sheet.png'

const town = await extractBlobs(townSrc, 'public/game/town/raw', 't', {
  minW: 4,
  minH: 4,
  maxW: 100,
  maxH: 100,
  minPixels: 15,
})
console.log('TOWN blobs:')
for (const b of town) console.log(`  ${b.name} @${b.left},${b.top} px=${b.c}`)

const interior = await extractBlobs(intSrc, 'public/game/interior/raw', 'i', {
  minW: 4,
  minH: 4,
  maxW: 80,
  maxH: 80,
  minPixels: 12,
})
console.log('INTERIOR blobs:')
for (const b of interior) console.log(`  ${b.name} @${b.left},${b.top} px=${b.c}`)
