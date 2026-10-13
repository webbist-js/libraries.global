import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import {
  BOUNDARIES_URL,
  ECONOMIES_URL,
  POPULATION_URL,
  prepareAtlasPopulation,
} from "./population-source"

async function main() {
  const sources = await Promise.all(
    [ECONOMIES_URL, POPULATION_URL, BOUNDARIES_URL].map(async (url) => {
      const response = await fetch(url, { signal: AbortSignal.timeout(60000) })
      if (!response.ok)
        throw new Error(`Population source HTTP ${response.status}`)

      return response.json()
    })
  )
  const { baseline, geojson } = prepareAtlasPopulation(
    sources[0],
    sources[1],
    sources[2],
    new Date().toISOString()
  )
  const root = path.resolve(__dirname, "../../../..")
  await mkdir(path.join(root, "packages/shared-data/atlas/data"), {
    recursive: true,
  })
  await mkdir(path.join(root, "apps/ui/public/atlas"), { recursive: true })
  // Validate all joins before writing either artifact; filenames are immutable.
  await writeFile(
    path.join(root, "apps/ui/public", baseline.geometryUrl),
    JSON.stringify(geojson)
  )
  await writeFile(
    path.join(root, "packages/shared-data/atlas/data/geography.json"),
    `${JSON.stringify(baseline, null, 2)}\n`
  )
  console.log(
    JSON.stringify({
      version: baseline.version,
      countries: baseline.countries.length,
      boundaries: geojson.features.length,
    })
  )
}

// eslint-disable-next-line unicorn/prefer-top-level-await -- CommonJS worker.
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Population preparation failed"
  )
  process.exitCode = 1
})
