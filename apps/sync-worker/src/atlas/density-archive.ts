import { createHash } from "node:crypto"
import { once } from "node:events"
import { createReadStream, createWriteStream } from "node:fs"
import { stat } from "node:fs/promises"
import path from "node:path"
import { createInterface } from "node:readline"

import {
  atlasCell,
  atlasCellId,
  atlasDensityCell,
  atlasDensityGeometry,
  ATLAS_DENSITY_VERSION,
  ATLAS_DENSITY_OFFSET,
  type AtlasDensityArchive,
  type AtlasPoint,
} from "@repo/shared-data"

import type { AtlasNativeRunner } from "./archive"

async function densityCells(
  source: string,
  resolution: number,
  signal: AbortSignal
) {
  const cells = new Map<string, number>()
  let count = 0
  const input = createReadStream(source)
  const lines = createInterface({ input, crlfDelay: Infinity })
  try {
    for await (const line of lines) {
      signal.throwIfAborted()
      const point: AtlasPoint = JSON.parse(line)
      if (
        point.properties.st === "permanently_closed" ||
        point.properties.v === false
      )
        continue
      const id = atlasCellId(
        {
          lng: point.geometry.coordinates[0],
          lat: point.geometry.coordinates[1],
        },
        resolution
      )
      cells.set(id, (cells.get(id) ?? 0) + 1)
      if (cells.size > 1_000_000)
        throw new Error("Atlas density resolution exceeds build memory budget")
      count++
    }
  } finally {
    lines.close()
    input.destroy()
  }

  return { cells, count }
}

/** Stream the same bounded snapshot as the point archive. One resolution is
 * retained at a time; there is no dense world grid or database cell table. */
export async function prepareAtlasDensity(
  source: string,
  destination: string,
  signal: AbortSignal
) {
  const output = createWriteStream(destination, { flags: "wx" })
  let streamError: Error | undefined
  output.on("error", (error) => {
    streamError = error
  })
  let sourceCount = 0,
    features = 0,
    bytes = 0
  try {
    for (let zoom = 0; zoom <= 16; zoom++) {
      const resolution = zoom + ATLAS_DENSITY_OFFSET
      const { cells, count } = await densityCells(source, resolution, signal)
      if (zoom === 0) sourceCount = count
      if (
        count !== sourceCount ||
        [...cells.values()].reduce((sum, n) => sum + n, 0) !== sourceCount
      )
        throw new Error("Atlas density source totals changed")
      for (const [id, total] of cells) {
        const value = atlasDensityCell(id, total)
        const cell = atlasCell(id)
        for (const [layer, geometry] of [
          ["density-grid", atlasDensityGeometry(id)],
          [
            "density",
            { type: "Point", coordinates: [cell.centre.lng, cell.centre.lat] },
          ],
        ] as const) {
          const line = `${JSON.stringify({ type: "Feature", geometry, properties: { cell: id, total, areaKm2: value.areaKm2, per100Km2: value.per100Km2 }, tippecanoe: { layer, minzoom: zoom, maxzoom: zoom } })}\n`
          bytes += Buffer.byteLength(line)
          if (bytes > 1024 ** 3)
            throw new Error("Atlas density scratch budget exceeded")
          if (streamError) throw streamError
          if (!output.write(line)) await once(output, "drain")
          features++
        }
      }
    }
    output.end()
    await once(output, "finish")

    return { sourceCount, features }
  } finally {
    output.destroy()
  }
}

export async function buildAtlasDensityArchive(
  options: {
    directory: string
    url: string
    validator: string
    run: AtlasNativeRunner
  },
  signal: AbortSignal
): Promise<AtlasDensityArchive | null> {
  const { directory, run, url, validator } = options
  const prepared = await prepareAtlasDensity(
    path.join(directory, "source.ndjson"),
    path.join(directory, "density.ndjson"),
    signal
  )
  if (!prepared.sourceCount) return null
  await run(
    "tippecanoe",
    [
      "-o",
      "density.mbtiles",
      "-Z0",
      "-z16",
      "-B0",
      "-r1",
      "-b127",
      "-M512000",
      "-O200000",
      "--no-tiny-polygon-reduction",
      "density.ndjson",
    ],
    directory,
    signal
  )
  const checked = JSON.parse(
    await run(
      "python3",
      [
        validator,
        "density.mbtiles",
        "density.ndjson",
        String(prepared.sourceCount),
      ],
      directory,
      signal
    )
  )
  if (checked.complete !== true || checked.sourceCount !== prepared.sourceCount)
    throw new Error("Incomplete Atlas density archive")
  await run(
    "pmtiles",
    ["convert", "density.mbtiles", "density.pmtiles"],
    directory,
    signal
  )
  await run("pmtiles", ["verify", "density.pmtiles"], directory, signal)
  const file = path.join(directory, "density.pmtiles")
  const hash = createHash("sha256")
  for await (const chunk of createReadStream(file)) {
    signal.throwIfAborted()
    hash.update(chunk)
  }

  return {
    version: ATLAS_DENSITY_VERSION,
    url,
    sha256: hash.digest("hex"),
    archiveBytes: (await stat(file)).size,
    count: prepared.sourceCount,
    maxZoom: 16,
  }
}
