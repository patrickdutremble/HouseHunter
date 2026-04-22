// One-shot: rasterises a white-house-on-black SVG into three PNGs in public/.
// Run with:  node scripts/generate-icons.mjs
// Requires `sharp`. Install ad-hoc with:  npm install --no-save sharp
import sharp from 'sharp'
import { writeFile } from 'node:fs/promises'

const houseSvg = (padding) => {
  const inner = 512 - padding * 2
  const stroke = Math.round(inner * 0.06)
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#000000"/>
  <g transform="translate(${padding},${padding})" fill="none" stroke="#ffffff" stroke-width="${stroke}" stroke-linejoin="round" stroke-linecap="round">
    <path d="M${inner * 0.12} ${inner * 0.52} L${inner * 0.5} ${inner * 0.14} L${inner * 0.88} ${inner * 0.52} L${inner * 0.88} ${inner * 0.88} L${inner * 0.12} ${inner * 0.88} Z"/>
    <path d="M${inner * 0.38} ${inner * 0.88} L${inner * 0.38} ${inner * 0.6} L${inner * 0.62} ${inner * 0.6} L${inner * 0.62} ${inner * 0.88}"/>
  </g>
</svg>`
}

const outputs = [
  { file: 'public/icon-192.png', size: 192, padding: 40 },
  { file: 'public/icon-512.png', size: 512, padding: 80 },
  { file: 'public/icon-maskable.png', size: 512, padding: 140 },
]

for (const { file, size, padding } of outputs) {
  const svg = houseSvg(padding)
  const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()
  await writeFile(file, buf)
  console.log(`wrote ${file} (${size}x${size})`)
}
