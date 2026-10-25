import { createHash } from "node:crypto"
import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import {
  atlasGeometryAreaKm2,
  atlasLocalGeography,
  atlasPopulationBaseline,
  type AtlasPolygonGeometry,
} from "@repo/shared-data"

import { runAtlasNative } from "./archive"

/** Historical codes belong to the 2023 geometry, not the changed 2025 districts.
 * The directory region membership is unchanged; never relabel the old geometry. */
const REPORTING_2023: Record<string, string> = {
  E08000038: "E08000016",
  E08000039: "E08000019",
}

export async function preparePopulationContext(root: string, python: string) {
  const countryFile = path.join(
    root,
    "apps/ui/public",
    atlasPopulationBaseline.geometryUrl
  )
  const country = JSON.parse(await readFile(countryFile, "utf8"))
  const local = JSON.parse(
    await readFile(
      path.join(root, "packages/shared-data/atlas/data/local-boundaries.json"),
      "utf8"
    )
  )
  const gazetteer = JSON.parse(
    await readFile(
      path.join(
        root,
        "apps/strapi/scripts/ingests/gazetteer/data/england.json"
      ),
      "utf8"
    )
  )
  const areas = new Map<
    string,
    { geometry: AtlasPolygonGeometry; properties: { code: string } }
  >(local.features.map((feature: any) => [feature.properties.code, feature]))
  const localAreas = Object.fromEntries(
    [...areas].map(([id, feature]) => [
      id,
      atlasGeometryAreaKm2(feature.geometry),
    ])
  )
  const countryAreas = Object.fromEntries(
    country.features.map((feature: any) => [
      feature.properties.iso3,
      atlasGeometryAreaKm2(feature.geometry),
    ])
  )
  const assigned = new Set<string>()
  const regions = gazetteer.regions.map((region: any) => {
    const members: string[] = region.areas.map(
      (area: any) => REPORTING_2023[area.gssCode] ?? area.gssCode
    )
    for (const code of members) {
      if (!areas.has(code) || assigned.has(code))
        throw new Error("Incompatible region membership")
      assigned.add(code)
    }
    const units = atlasLocalGeography.areas.filter((area) =>
      members.includes(area.code)
    )

    return {
      id: region.key,
      name: region.name,
      members,
      areaKm2: members.reduce((sum, code) => sum + localAreas[code]!, 0),
      bounds: {
        west: Math.min(...units.map((area) => area.bounds.west)),
        east: Math.max(...units.map((area) => area.bounds.east)),
        south: Math.min(...units.map((area) => area.bounds.south)),
        north: Math.max(...units.map((area) => area.bounds.north)),
      },
    }
  })
  const expected = atlasLocalGeography.areas
    .filter((area) => area.code.startsWith("E"))
    .map((area) => area.code)
  if (
    assigned.size !== expected.length ||
    expected.some((code) => !assigned.has(code))
  )
    throw new Error("England region membership is incomplete")
  const directory = await mkdtemp(path.join(tmpdir(), "atlas-population-"))
  try {
    const source = path.join(directory, "input.json"),
      output = path.join(directory, "regions.geojson")
    await writeFile(
      source,
      JSON.stringify({ features: local.features, regions })
    )
    await runAtlasNative(
      python,
      [path.join(root, "apps/analysis/prepare_geography.py"), source, output],
      directory,
      AbortSignal.timeout(60000)
    )
    const bytes = await readFile(output)
    if (bytes.length > 2 * 1024 * 1024)
      throw new Error("Region display geometry exceeds budget")
    const hash = createHash("sha256").update(bytes).digest("hex")
    const geometryUrl = `/atlas/population-regions-${hash.slice(0, 16)}.geojson`
    await writeFile(path.join(root, "apps/ui/public", geometryUrl), bytes)
    const result = {
      schemaVersion: 1,
      version: createHash("sha256")
        .update(JSON.stringify({ countryAreas, localAreas, regions, hash }))
        .digest("hex")
        .slice(0, 16),
      localBoundaryVersion: atlasLocalGeography.version,
      countryBoundaryVersion: atlasPopulationBaseline.version,
      areaMethod:
        "Spherical polygon area, mean Earth radius 6371.0088 km; source boundary extent including its inland waters, not a separate land-area estimate.",
      countryAreas,
      localAreas,
      regions,
      regionGeometryUrl: geometryUrl,
    }
    const target = path.join(
      root,
      "packages/shared-data/atlas/data/population-geography.json"
    )
    await writeFile(`${target}.tmp`, JSON.stringify(result))
    await rename(`${target}.tmp`, target)

    return {
      countries: Object.keys(countryAreas).length,
      localAreas: areas.size,
      regions: regions.length,
      geometryBytes: bytes.length,
      version: result.version,
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

if (require.main === module)
  preparePopulationContext(
    path.resolve(__dirname, "../../../.."),
    process.env.ANALYSIS_PYTHON ?? "python3"
  )
    .then((result) => console.log(JSON.stringify(result)))
    // eslint-disable-next-line unicorn/prefer-top-level-await -- This worker CLI compiles to CommonJS.
    .catch((error) => {
      console.error(error.message)
      process.exitCode = 1
    })
