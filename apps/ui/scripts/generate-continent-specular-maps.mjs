import fs from "node:fs/promises"
import path from "node:path"

import sharp from "sharp"

const globeDir = path.resolve("apps/ui/public/images/globe")
const OUTPUT_SIZE = 1536
const DOT_GRID_PADDING = 20
const DOT_GRID_STEP = 21
const DOT_JITTER = 4
const SVG_RENDER_DENSITY = 1200
const BASE_DOT_COLOR = { b: 238, g: 216, r: 195 }
const HIGHLIGHT_DOT_COLOR = { b: 255, g: 251, r: 247 }
const GLOW_COLOR = { b: 255, g: 201, r: 118 }

const assets = [
  {
    dots: "continent-africa-dots.png",
    output: "continent-africa-specular.png",
    seed: 11,
    source: "continent-africa-source.svg",
  },
  {
    dots: "continent-americas-dots.png",
    output: "continent-americas-specular.png",
    seed: 23,
    source: "continent-americas-source.svg",
  },
  {
    dots: "continent-asia-dots.png",
    output: "continent-asia-specular.png",
    seed: 37,
    source: "continent-asia-source.svg",
  },
  {
    dots: "continent-europe-dots.png",
    output: "continent-europe-specular.png",
    seed: 41,
    source: "continent-europe-source.svg",
  },
  {
    dots: "continent-oceania-dots.png",
    output: "continent-oceania-specular.png",
    seed: 53,
    source: "continent-oceania-source.svg",
  },
]

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function createSeededRandom(seed) {
  return () => {
    seed = Math.trunc(seed)
    seed = Math.trunc(seed + 0x6d2b79f5)
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function isolateHighlightedContinent(svg) {
  return svg
    .replaceAll("#374932", "#ffffff")
    .replaceAll("#BCD6B4", "transparent")
    .replaceAll("#E7F7F4", "transparent")
    .replaceAll("display:none;fill:none;", "display:none;fill:transparent;")
}

function intersects(first, second) {
  return !(
    first.left > second.left + second.width ||
    second.left > first.left + first.width ||
    first.top > second.top + second.height ||
    second.top > first.top + first.height
  )
}

async function getConnectedMask(imageBuffer) {
  const { data, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const width = info.width
  const height = info.height
  const pixelCount = width * height
  const alphaMask = new Uint8Array(pixelCount)
  const labels = new Uint32Array(pixelCount)

  for (let index = 0; index < pixelCount; index += 1) {
    alphaMask[index] = data[index * info.channels + 3] > 16 ? 1 : 0
  }

  const components = []
  const stack = []

  for (let index = 0; index < pixelCount; index += 1) {
    if (alphaMask[index] === 0 || labels[index] !== 0) {
      continue
    }

    const componentId = components.length + 1
    let area = 0
    let minX = width
    let minY = height
    let maxX = 0
    let maxY = 0

    stack.push(index)
    labels[index] = componentId

    while (stack.length > 0) {
      const current = stack.pop()
      const x = current % width
      const y = Math.floor(current / width)

      area += 1
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)

      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (offsetX === 0 && offsetY === 0) {
            continue
          }

          const nextX = x + offsetX
          const nextY = y + offsetY

          if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) {
            continue
          }

          const nextIndex = nextY * width + nextX

          if (alphaMask[nextIndex] === 0 || labels[nextIndex] !== 0) {
            continue
          }

          labels[nextIndex] = componentId
          stack.push(nextIndex)
        }
      }
    }

    components.push({
      area,
      height: maxY - minY + 1,
      id: componentId,
      left: minX,
      top: minY,
      width: maxX - minX + 1,
    })
  }

  if (components.length === 0) {
    return sharp(imageBuffer)
      .resize(OUTPUT_SIZE, OUTPUT_SIZE, {
        background: { alpha: 0, b: 0, g: 0, r: 0 },
        fit: "contain",
      })
      .png()
      .toBuffer()
  }

  // Non-empty: the zero-component case returned above.
  const largestComponent = components.reduce(
    (largest, component) =>
      component.area > largest.area ? component : largest,
    components[0]
  )
  const expandedLargestBounds = {
    height: largestComponent.height + Math.round(largestComponent.height * 0.9),
    left: Math.max(
      0,
      largestComponent.left - Math.round(largestComponent.width * 0.55)
    ),
    top: Math.max(
      0,
      largestComponent.top - Math.round(largestComponent.height * 0.55)
    ),
    width: largestComponent.width + Math.round(largestComponent.width * 1.1),
  }

  const keepIds = new Set(
    components
      .filter((component) => {
        const hasMeaningfulArea = component.area >= largestComponent.area * 0.02

        return hasMeaningfulArea || intersects(component, expandedLargestBounds)
      })
      .map((component) => component.id)
  )

  const filtered = Buffer.alloc(pixelCount * 4)
  let filteredMinX = width
  let filteredMinY = height
  let filteredMaxX = 0
  let filteredMaxY = 0

  for (let index = 0; index < pixelCount; index += 1) {
    if (!keepIds.has(labels[index])) {
      continue
    }

    const x = index % width
    const y = Math.floor(index / width)
    const pixelOffset = index * 4

    filtered[pixelOffset] = 255
    filtered[pixelOffset + 1] = 255
    filtered[pixelOffset + 2] = 255
    filtered[pixelOffset + 3] = 255

    filteredMinX = Math.min(filteredMinX, x)
    filteredMinY = Math.min(filteredMinY, y)
    filteredMaxX = Math.max(filteredMaxX, x)
    filteredMaxY = Math.max(filteredMaxY, y)
  }

  return sharp(filtered, {
    raw: {
      channels: 4,
      height,
      width,
    },
  })
    .extract({
      height: filteredMaxY - filteredMinY + 1,
      left: filteredMinX,
      top: filteredMinY,
      width: filteredMaxX - filteredMinX + 1,
    })
    .resize(OUTPUT_SIZE, OUTPUT_SIZE, {
      background: { alpha: 0, b: 0, g: 0, r: 0 },
      fit: "contain",
    })
    .png()
    .toBuffer()
}

async function createDotMap(specularBuffer, seed) {
  const { data, info } = await sharp(specularBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const random = createSeededRandom(seed)
  const glowDots = []
  const haloDots = []
  const coreDots = []

  for (
    let y = DOT_GRID_PADDING;
    y < info.height - DOT_GRID_PADDING;
    y += DOT_GRID_STEP
  ) {
    for (
      let x = DOT_GRID_PADDING;
      x < info.width - DOT_GRID_PADDING;
      x += DOT_GRID_STEP
    ) {
      const jitteredX = Math.round(x + (random() - 0.5) * DOT_JITTER * 2)
      const jitteredY = Math.round(y + (random() - 0.5) * DOT_JITTER * 2)
      const clampedX = clamp(jitteredX, 0, info.width - 1)
      const clampedY = clamp(jitteredY, 0, info.height - 1)
      const alpha =
        data[(clampedY * info.width + clampedX) * info.channels + 3] / 255

      if (alpha < 0.18 || random() < 0.05) {
        continue
      }

      const intensity = 0.48 + random() * 0.52
      const coreRadius = 1.18 + intensity * 0.66
      const haloRadius = coreRadius * (1.64 + random() * 0.16)
      const glowRadius = coreRadius * (2.4 + random() * 0.22)
      const glowOpacity = 0.032 + intensity * 0.02
      const haloOpacity = 0.086 + intensity * 0.064
      const coreOpacity = 0.72 + intensity * 0.11

      glowDots.push(
        `<circle cx="${clampedX}" cy="${clampedY}" r="${glowRadius.toFixed(
          2
        )}" fill="rgba(${GLOW_COLOR.r},${GLOW_COLOR.g},${GLOW_COLOR.b},${glowOpacity.toFixed(
          3
        )})" />`
      )
      haloDots.push(
        `<circle cx="${clampedX}" cy="${clampedY}" r="${haloRadius.toFixed(
          2
        )}" fill="rgba(${BASE_DOT_COLOR.r},${BASE_DOT_COLOR.g},${BASE_DOT_COLOR.b},${haloOpacity.toFixed(
          3
        )})" />`
      )
      coreDots.push(
        `<circle cx="${clampedX}" cy="${clampedY}" r="${coreRadius.toFixed(
          2
        )}" fill="rgba(${HIGHLIGHT_DOT_COLOR.r},${HIGHLIGHT_DOT_COLOR.g},${HIGHLIGHT_DOT_COLOR.b},${coreOpacity.toFixed(
          3
        )})" />`
      )
    }
  }

  const dotSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${OUTPUT_SIZE}" height="${OUTPUT_SIZE}" viewBox="0 0 ${OUTPUT_SIZE} ${OUTPUT_SIZE}">
      <defs>
        <filter id="continent-dot-glow">
          <feGaussianBlur stdDeviation="1.1" />
        </filter>
      </defs>
      <g filter="url(#continent-dot-glow)">${glowDots.join("")}</g>
      <g>${haloDots.join("")}</g>
      <g>${coreDots.join("")}</g>
    </svg>
  `

  return sharp(Buffer.from(dotSvg)).png().toBuffer()
}

await Promise.all(
  assets.map(async ({ dots, output, seed, source }) => {
    const inputPath = path.join(globeDir, source)
    const outputPath = path.join(globeDir, output)
    const dotsPath = path.join(globeDir, dots)
    const inputSvg = await fs.readFile(inputPath, "utf8")
    const isolatedSvg = isolateHighlightedContinent(inputSvg)
    const rendered = await sharp(Buffer.from(isolatedSvg), {
      density: SVG_RENDER_DENSITY,
    })
      .png()
      .toBuffer()
    const specularBuffer = await getConnectedMask(rendered)
    const dotBuffer = await createDotMap(specularBuffer, seed)

    await Promise.all([
      fs.writeFile(outputPath, specularBuffer),
      fs.writeFile(dotsPath, dotBuffer),
    ])
  })
)
