import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { readFile, stat } from "node:fs/promises"

import {
  atlasPopulationBaseline,
  type AtlasCountryTiles,
} from "@repo/shared-data"

import type { AtlasNativeRunner } from "./archive"

/** Open boundary geometry only: paid live library counts are never baked into tiles. */
export async function buildAtlasCountryArchive(
  options: {
    source: string
    validator: string
    directory: string
    url: string
    run: AtlasNativeRunner
  },
  signal: AbortSignal
): Promise<AtlasCountryTiles> {
  const source = await readFile(options.source)
  if (
    source.byteLength > 8 * 1024 * 1024 ||
    createHash("sha256").update(source).digest("hex") !==
      atlasPopulationBaseline.geometrySha256
  )
    throw new Error("Country geometry does not match the population baseline")
  await options.run(
    "tippecanoe",
    [
      "-o",
      "countries.mbtiles",
      "-l",
      "countries",
      "-Z0",
      "-z6",
      "-d14",
      "-D14",
      "-r1",
      "--no-tiny-polygon-reduction",
      "-M512000",
      "-y",
      "iso3",
      "-y",
      "name",
      options.source,
    ],
    options.directory,
    signal
  )
  const validation = JSON.parse(
    await options.run(
      "python3",
      [options.validator, "countries.mbtiles", options.source],
      options.directory,
      signal
    )
  )
  const expected = atlasPopulationBaseline.countries.filter(
    (country) => country.featureId !== null
  ).length
  if (validation.complete !== true || validation.sourceCount !== expected)
    throw new Error("Incomplete country archive")
  await options.run(
    "pmtiles",
    ["convert", "countries.mbtiles", "countries.pmtiles"],
    options.directory,
    signal
  )
  await options.run(
    "pmtiles",
    ["verify", "countries.pmtiles"],
    options.directory,
    signal
  )
  const file = `${options.directory}/countries.pmtiles`,
    hash = createHash("sha256")
  for await (const chunk of createReadStream(file)) {
    signal.throwIfAborted()
    hash.update(chunk)
  }

  return {
    version: atlasPopulationBaseline.version,
    url: options.url,
    sourceLayer: "countries",
    maxZoom: 6,
    archiveBytes: (await stat(file)).size,
    sha256: hash.digest("hex"),
  }
}
