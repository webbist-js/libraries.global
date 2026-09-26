/**
 * download-london-boroughs.mjs
 *
 * Downloads London borough boundaries from Overpass API (OpenStreetMap)
 * and writes them to public/boundaries/areas/greater-london.geojson.
 *
 * Usage:
 *   node apps/ui/scripts/download-london-boroughs.mjs
 */

import { writeFile, mkdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_FILE = path.join(
  __dirname,
  "../public/boundaries/areas/greater-london.geojson"
)

const SLUG_MAP = {
  "City of London": "city-of-london",
  "Barking and Dagenham": "barking-and-dagenham",
  "Hammersmith and Fulham": "hammersmith-and-fulham",
  "Kensington and Chelsea": "kensington-and-chelsea",
  "Kingston upon Thames": "kingston-upon-thames",
  "Richmond upon Thames": "richmond-upon-thames",
  "Tower Hamlets": "tower-hamlets",
  "Waltham Forest": "waltham-forest",
}

// Three independent query strategies — first one that returns relations wins.
// Strategy 1: London borough GSS codes all start with E09 (most reliable)
// Strategy 2: Relations tagged as London Boroughs by name
// Strategy 3: admin_level=6 within Greater London area (OSM UK scheme uses 6 for boroughs)
const QUERIES = [
  `[out:json][timeout:90];rel["ref:gss"~"^E09"]["boundary"="administrative"];out geom;`,
  `[out:json][timeout:90];rel["name"~"London Borough"]["boundary"="administrative"];out geom;`,
  `[out:json][timeout:90];area["name"="Greater London"]["admin_level"="5"]->.gl;rel(area.gl)["boundary"="administrative"]["admin_level"="6"];out geom;`,
]

// Primary: private.coffee instance (https://overpass.kumi.systems = overpass.private.coffee)
// Fallback: main overpass-api.de instance
const OVERPASS_BASE = "https://overpass.private.coffee/api/interpreter"
const OVERPASS_MIRROR = "https://overpass-api.de/api/interpreter"

// ── OSM relation → GeoJSON ────────────────────────────────────────────────────

function wayGeomToCoords(geom) {
  return geom.map((pt) => [pt.lon, pt.lat])
}

function joinWays(ways) {
  if (!ways.length) return []

  const segments = ways.map((w) => wayGeomToCoords(w.geometry))

  if (segments.length === 1) {
    const ring = segments[0]
    const first = ring[0],
      last = ring.at(-1)
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push(ring[0])

    return ring
  }

  let ring = segments[0]
  const remaining = segments.slice(1)

  while (remaining.length) {
    const [lx, ly] = ring.at(-1)
    let joined = false
    const eps = 1e-7

    for (let i = 0; i < remaining.length; i++) {
      const seg = remaining[i]
      const [fx, fy] = seg[0]
      const [ex, ey] = seg.at(-1)

      if (Math.abs(fx - lx) < eps && Math.abs(fy - ly) < eps) {
        ring = [...ring, ...seg.slice(1)]
        remaining.splice(i, 1)
        joined = true
        break
      }
      if (Math.abs(ex - lx) < eps && Math.abs(ey - ly) < eps) {
        ring = [...ring, ...seg.slice(0, -1).reverse()]
        remaining.splice(i, 1)
        joined = true
        break
      }
    }

    if (!joined) {
      for (const seg of remaining) ring = [...ring, ...seg]
      break
    }
  }

  const first = ring[0],
    last = ring.at(-1)
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push(ring[0])

  return ring
}

function relationToFeature(rel) {
  const outerWays = (rel.members ?? []).filter(
    (m) =>
      m.type === "way" &&
      m.role === "outer" &&
      Array.isArray(m.geometry) &&
      m.geometry.length >= 2
  )
  const innerWays = (rel.members ?? []).filter(
    (m) =>
      m.type === "way" &&
      m.role === "inner" &&
      Array.isArray(m.geometry) &&
      m.geometry.length >= 2
  )

  if (!outerWays.length) {
    console.debug(`  ⚠  Skipping "${rel.tags?.name}" — no outer way geometry`)

    return null
  }

  const outerRing = joinWays(outerWays)
  if (outerRing.length < 4) return null

  const rings = [outerRing]
  if (innerWays.length) {
    const inner = joinWays(innerWays)
    if (inner.length >= 4) rings.push(inner)
  }

  const geometry =
    rings.length === 1
      ? { type: "Polygon", coordinates: rings }
      : { type: "MultiPolygon", coordinates: rings.map((r) => [r]) }

  const name = rel.tags?.name ?? ""
  const code = rel.tags?.["ref:gss"] ?? ""
  const slug =
    SLUG_MAP[name] ??
    name
      .toLowerCase()
      .replaceAll(/\s+/g, "-")
      .replaceAll(/[^a-z0-9-]/g, "")

  return { type: "Feature", geometry, properties: { name, code, slug } }
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function tryFetch(baseUrl, query) {
  console.debug(`  POST ${baseUrl}`)
  console.debug(`  Query: ${query.slice(0, 80)}…`)

  // Use POST to avoid URL length issues
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "libraries.global/1.0",
    },
    body: `data=${encodeURIComponent(query)}`,
  })

  console.debug(`  Status: ${res.status}`)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`)
  }

  return res.json()
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.debug("📦  London Borough Boundary Downloader\n")

  let relations = []

  // eslint-disable-next-line sonarjs/no-labels -- exits both the mirror and query loops on first success
  outer: for (const baseUrl of [OVERPASS_BASE, OVERPASS_MIRROR]) {
    for (const query of QUERIES) {
      try {
        const data = await tryFetch(baseUrl, query)
        const rels = (data.elements ?? []).filter(
          (el) => el.type === "relation"
        )
        console.debug(`  → ${rels.length} relations returned\n`)
        if (rels.length > 0) {
          relations = rels
          break outer
        }
      } catch (err) {
        console.debug(`  Failed: ${err.message}\n`)
      }
    }
  }

  if (!relations.length) {
    throw new Error("No relations returned from any query/instance combination")
  }

  const features = relations.map(relationToFeature).filter(Boolean)
  console.debug(`Converted ${features.length} features\n`)

  const fc = { type: "FeatureCollection", features }
  await mkdir(path.dirname(OUT_FILE), { recursive: true })
  await writeFile(OUT_FILE, JSON.stringify(fc, null, 2))

  const kb = (JSON.stringify(fc).length / 1024).toFixed(1)
  console.debug(
    `✓  Saved → public/boundaries/areas/greater-london.geojson (${kb} KB)\n`
  )
  console.debug("Borough slugs:")
  for (const f of features) {
    console.debug(
      `  ${f.properties.name.padEnd(32)} ${f.properties.code.padEnd(10)} → ${f.properties.slug}`
    )
  }
}

main().catch((err) => {
  console.error("\n✗  Fatal:", err.message)
  process.exit(1)
})
