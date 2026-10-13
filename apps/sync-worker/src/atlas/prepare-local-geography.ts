import { createHash } from "node:crypto"
import { writeFile } from "node:fs/promises"
import path from "node:path"

const BASE =
  "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Local_Authority_Districts_December_2023_Boundaries_UK_"
async function download(kind: "BGC" | "BUC") {
  const url = `${BASE}${kind}/FeatureServer/0/query?where=1%3D1&outFields=LAD23CD,LAD23NM&outSR=4326&geometryPrecision=5&f=geojson`
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) })
  if (!response.ok) throw new Error(`ONS boundaries HTTP ${response.status}`)
  const data = (await response.json()) as any
  if (
    data.type !== "FeatureCollection" ||
    data.features?.length !== 361 ||
    data.exceededTransferLimit
  )
    throw new Error("Incomplete ONS district boundaries")
  const codes = new Set<string>()

  return data.features
    .map((feature: any) => {
      const code = feature.properties.LAD23CD
      if (
        !/^[EWSN]\d{8}$/.test(code) ||
        codes.has(code) ||
        !["Polygon", "MultiPolygon"].includes(feature.geometry?.type)
      )
        throw new Error("Invalid ONS district identity")
      codes.add(code)
      const positions = feature.geometry.coordinates.flat(
        feature.geometry.type === "Polygon" ? 1 : 2
      ) as number[][]
      const bounds = { west: 180, east: -180, south: 90, north: -90 }
      for (const [lng, lat] of positions) {
        if (
          !Number.isFinite(lng) ||
          !Number.isFinite(lat) ||
          Math.abs(lng!) > 180 ||
          Math.abs(lat!) > 90
        )
          throw new Error("Invalid ONS coordinate")
        bounds.west = Math.min(bounds.west, lng!)
        bounds.east = Math.max(bounds.east, lng!)
        bounds.south = Math.min(bounds.south, lat!)
        bounds.north = Math.max(bounds.north, lat!)
      }

      return {
        type: "Feature",
        id: code,
        properties: { code, name: feature.properties.LAD23NM, bounds },
        geometry: feature.geometry,
      }
    })
    .sort((a: any, b: any) => a.id.localeCompare(b.id))
}
async function main() {
  const [precise, display] = await Promise.all([
    download("BGC"),
    download("BUC"),
  ])
  if (
    JSON.stringify(precise.map((row: any) => row.id)) !==
    JSON.stringify(display.map((row: any) => row.id))
  )
    throw new Error("ONS boundary versions disagree")
  const text = JSON.stringify({
    type: "FeatureCollection",
    features: display.map(
      ({
        properties: { bounds: _bounds, ...properties },
        ...feature
      }: any) => ({ ...feature, properties })
    ),
  })
  const hash = createHash("sha256").update(text).digest("hex")
  const version = createHash("sha256")
    .update(JSON.stringify(precise))
    .update(hash)
    .digest("hex")
    .slice(0, 16)
  const metadata = {
    version,
    geometryUrl: `/atlas/local-areas-${hash.slice(0, 16)}.geojson`,
    boundarySource:
      "ONS Local Authority Districts, December 2023 (BGC for assignment; BUC for display)",
    boundaryUrl:
      "https://www.data.gov.uk/dataset/31c78354-168f-4457-b8f3-80e86adcd0f4/local-authority-districts-december-2023-boundaries-uk-bgc",
    boundaryLicence:
      "Open Government Licence v3.0; contains OS and ONS intellectual property",
    boundaryYear: 2023,
    countries: ["GBR"],
    areas: precise.map((row: any) => ({
      code: row.id,
      name: row.properties.name,
      country: "GBR",
      bounds: row.properties.bounds,
    })),
  }
  const root = path.resolve(__dirname, "../../../..")
  await writeFile(path.join(root, "apps/ui/public", metadata.geometryUrl), text)
  await writeFile(
    path.join(root, "packages/shared-data/atlas/data/local-boundaries.json"),
    JSON.stringify({ version, features: precise })
  )
  await writeFile(
    path.join(root, "packages/shared-data/atlas/data/local-geography.json"),
    `${JSON.stringify(metadata, null, 2)}\n`
  )
  console.log(
    JSON.stringify({
      version,
      areas: precise.length,
      displayBytes: Buffer.byteLength(text),
    })
  )
}
// eslint-disable-next-line unicorn/prefer-top-level-await -- CommonJS worker.
main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
