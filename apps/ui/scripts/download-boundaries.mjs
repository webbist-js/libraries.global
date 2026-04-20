/**
 * download-boundaries.mjs
 *
 * Downloads and processes boundary GeoJSON from official open sources
 * and writes them into apps/ui/public/boundaries/ for static serving.
 *
 * Sources:
 *   - UK Countries:        ONS Open Geography Portal (OGL v3)
 *   - English Regions:     ONS Open Geography Portal (OGL v3)
 *   - European Countries:  Natural Earth 50m Admin-0 (public domain)
 *
 * Usage:
 *   node apps/ui/scripts/download-boundaries.mjs
 *
 * Output:
 *   public/boundaries/continents/europe.geojson   ← all European countries (excl. UK — handled by countries/uk.geojson)
 *   public/boundaries/countries/uk.geojson        ← all 4 UK countries
 *   public/boundaries/regions/england.geojson     ← all 9 English regions
 *   public/boundaries/seed-data.json              ← centroid/bbox per feature (paste into Strapi)
 */

import { writeFile, mkdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = path.join(__dirname, "../public/boundaries")

// ── Source notes ──────────────────────────────────────────────────────────────
// ONS (UK/regions): OGL v3 — BUC = Boundaries Ultra-generalised Clipped to coastline.
// Natural Earth: public domain — 50m scale. https://www.naturalearthdata.com/

// Natural Earth source URL candidates (10m → 50m → 110m fallback)
const NE_URLS = [
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson",
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson",
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson",
]

const NE_ATTRIBUTION =
  "Natural Earth public domain map data. https://www.naturalearthdata.com/"

const SOURCES = {
  // ── Natural Earth — African countries ───────────────────────────────────────
  "continents/africa": {
    url: NE_URLS[0],
    fallbackUrls: NE_URLS.slice(1),
    filterFeature: (f) => f.properties?.CONTINENT === "Africa",
    nameField: ["ADMIN", "NAME"],
    codeField: ["ISO_A2"],
    attribution: NE_ATTRIBUTION,
    slugMap: {
      "Dem. Rep. Congo": "democratic-republic-of-the-congo",
      "Democratic Republic of the Congo": "democratic-republic-of-the-congo",
      "Central African Rep.": "central-african-republic",
      "Central African Republic": "central-african-republic",
      "Eq. Guinea": "equatorial-guinea",
      "Equatorial Guinea": "equatorial-guinea",
      "S. Sudan": "south-sudan",
      "South Sudan": "south-sudan",
      "W. Sahara": "western-sahara",
      "Western Sahara": "western-sahara",
      "Côte d'Ivoire": "cote-divoire",
      "Ivory Coast": "cote-divoire",
      "São Tomé and Príncipe": "sao-tome-and-principe",
      "Sao Tome and Principe": "sao-tome-and-principe",
      eSwatini: "eswatini",
      Swaziland: "eswatini",
      Congo: "republic-of-the-congo",
      "Republic of the Congo": "republic-of-the-congo",
      "United Republic of Tanzania": "tanzania",
      Tanzania: "tanzania",
      "Burkina Faso": "burkina-faso",
      "Guinea-Bissau": "guinea-bissau",
      "Sierra Leone": "sierra-leone",
    },
  },

  // ── Natural Earth — Americas (North + South) ─────────────────────────────
  "continents/americas": {
    url: NE_URLS[0],
    fallbackUrls: NE_URLS.slice(1),
    filterFeature: (f) =>
      f.properties?.CONTINENT === "North America" ||
      f.properties?.CONTINENT === "South America",
    nameField: ["ADMIN", "NAME"],
    codeField: ["ISO_A2"],
    attribution: NE_ATTRIBUTION,
    slugMap: {
      "United States of America": "united-states-of-america",
      "Dominican Rep.": "dominican-republic",
      "Dominican Republic": "dominican-republic",
      "Puerto Rico": "puerto-rico",
      "Trinidad and Tobago": "trinidad-and-tobago",
      "Costa Rica": "costa-rica",
      "El Salvador": "el-salvador",
      "Antigua and Barb.": "antigua-and-barbuda",
      "Antigua and Barbuda": "antigua-and-barbuda",
      "St. Kitts and Nevis": "saint-kitts-and-nevis",
      "Saint Kitts and Nevis": "saint-kitts-and-nevis",
      "St. Lucia": "saint-lucia",
      "Saint Lucia": "saint-lucia",
      "St. Vincent and the Grenadines": "saint-vincent-and-the-grenadines",
      "Saint Vincent and the Grenadines": "saint-vincent-and-the-grenadines",
      "Saint Vincent and Grenadines": "saint-vincent-and-the-grenadines",
      "New Zealand": "new-zealand",
      "Papua New Guinea": "papua-new-guinea",
    },
  },

  // ── Natural Earth — Asian countries ──────────────────────────────────────
  "continents/asia": {
    url: NE_URLS[0],
    fallbackUrls: NE_URLS.slice(1),
    filterFeature: (f) => f.properties?.CONTINENT === "Asia",
    nameField: ["ADMIN", "NAME"],
    codeField: ["ISO_A2"],
    attribution: NE_ATTRIBUTION,
    slugMap: {
      "Saudi Arabia": "saudi-arabia",
      "United Arab Emirates": "united-arab-emirates",
      "North Korea": "north-korea",
      "South Korea": "south-korea",
      "Sri Lanka": "sri-lanka",
      "East Timor": "timor-leste",
      "Timor-Leste": "timor-leste",
      "North Macedonia": "north-macedonia",
      "Palestinian Territories": "palestine",
      "West Bank": "palestine",
      Myanmar: "myanmar",
      "Brunei Darussalam": "brunei",
      Brunei: "brunei",
      "Hong Kong S.A.R.": "hong-kong",
      "Macao S.A.R": "macau",
    },
  },

  // ── Natural Earth — Oceanian countries ───────────────────────────────────
  "continents/oceania": {
    url: NE_URLS[0],
    fallbackUrls: NE_URLS.slice(1),
    filterFeature: (f) => f.properties?.CONTINENT === "Oceania",
    nameField: ["ADMIN", "NAME"],
    codeField: ["ISO_A2"],
    attribution: NE_ATTRIBUTION,
    slugMap: {
      "New Zealand": "new-zealand",
      "Papua New Guinea": "papua-new-guinea",
      "Solomon Islands": "solomon-islands",
      "Marshall Islands": "marshall-islands",
      "Federated States of Micronesia": "micronesia",
      Micronesia: "micronesia",
    },
  },

  // ── Natural Earth — European countries ──────────────────────────────────────
  // Filters to CONTINENT === "Europe"; excludes UK (ISO_A2 === "GB") because
  // England/Scotland/Wales/Northern Ireland are separate Strapi country records
  // served from countries/uk.geojson.
  "continents/europe": {
    url: NE_URLS[0],
    fallbackUrls: NE_URLS.slice(1),
    filterFeature: (f) =>
      f.properties?.CONTINENT === "Europe" && f.properties?.ISO_A2 !== "GB",
    nameField: ["ADMIN", "NAME"],
    codeField: ["ISO_A2"],
    attribution: NE_ATTRIBUTION,
    slugMap: {
      "Bosnia and Herzegovina": "bosnia-and-herzegovina",
      "Czech Republic": "czech-republic",
      Czechia: "czechia",
      "North Macedonia": "north-macedonia",
      "Republic of Serbia": "serbia",
      Serbia: "serbia",
      "Republic of Kosovo": "kosovo",
      Kosovo: "kosovo",
      Montenegro: "montenegro",
      Moldova: "moldova",
      "Republic of Moldova": "moldova",
      Belarus: "belarus",
      Ukraine: "ukraine",
      Russia: "russia",
      "Holy See": "vatican-city",
      "San Marino": "san-marino",
      Liechtenstein: "liechtenstein",
      "Faroe Islands": "faroe-islands",
      Åland: "aland",
      Iceland: "iceland",
      Norway: "norway",
      Sweden: "sweden",
      Finland: "finland",
      Denmark: "denmark",
      Estonia: "estonia",
      Latvia: "latvia",
      Lithuania: "lithuania",
      Poland: "poland",
      Germany: "germany",
      France: "france",
      Spain: "spain",
      Portugal: "portugal",
      Italy: "italy",
      Greece: "greece",
      Netherlands: "netherlands",
      Belgium: "belgium",
      Luxembourg: "luxembourg",
      Switzerland: "switzerland",
      Austria: "austria",
      Hungary: "hungary",
      Romania: "romania",
      Bulgaria: "bulgaria",
      Slovakia: "slovakia",
      Slovenia: "slovenia",
      Croatia: "croatia",
      Albania: "albania",
      "North Macedonia": "north-macedonia",
      "Bosnia and Herz.": "bosnia-and-herzegovina",
      Ireland: "ireland",
      Malta: "malta",
      Cyprus: "cyprus",
      Andorra: "andorra",
      Monaco: "monaco",
    },
  },
  "countries/uk": {
    url:
      "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/" +
      "Countries_December_2023_UK_BUC/FeatureServer/0/query" +
      "?where=1%3D1&outFields=CTRY23CD%2CCTRY23NM&outSR=4326&f=geojson",
    // Fallback to 2022 vintage if 2023 not yet published
    fallbackUrl:
      "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/" +
      "Countries_December_2022_UK_BUC/FeatureServer/0/query" +
      "?where=1%3D1&outFields=CTRY22CD%2CCTRY22NM&outSR=4326&f=geojson",
    nameField: ["CTRY23NM", "CTRY22NM"],
    codeField: ["CTRY23CD", "CTRY22CD"],
    attribution:
      "Contains National Statistics data © Crown copyright and database right 2023. Source: ONS Open Geography Portal. Licensed under OGL v3.",
    slugMap: {
      England: "england",
      Scotland: "scotland",
      Wales: "wales",
      "Northern Ireland": "northern-ireland",
    },
  },
  // areas/greater-london is generated by a dedicated script:
  //   node apps/ui/scripts/download-london-boroughs.mjs
  // (Overpass API + custom OSM→GeoJSON conversion; kept separate from this script)
  "regions/england": {
    url:
      "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/" +
      "Regions_December_2024_EN_BUC/FeatureServer/0/query" +
      "?where=1%3D1&outFields=RGN24CD%2CRGN24NM&outSR=4326&f=geojson",
    fallbackUrls: [
      // 2023 vintage
      "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/" +
        "Regions_December_2023_EN_BUC/FeatureServer/0/query" +
        "?where=1%3D1&outFields=RGN23CD%2CRGN23NM&outSR=4326&f=geojson",
      // 2022 vintage — service name without trailing _2022
      "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/" +
        "Regions_December_2022_EN_BUC/FeatureServer/0/query" +
        "?where=1%3D1&outFields=RGN22CD%2CRGN22NM&outSR=4326&f=geojson",
      // 2021 vintage
      "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/" +
        "Regions_December_2021_EN_BUC/FeatureServer/0/query" +
        "?where=1%3D1&outFields=RGN21CD%2CRGN21NM&outSR=4326&f=geojson",
    ],
    nameField: ["RGN24NM", "RGN23NM", "RGN22NM", "RGN21NM"],
    codeField: ["RGN24CD", "RGN23CD", "RGN22CD", "RGN21CD"],
    attribution:
      "Contains National Statistics data © Crown copyright and database right 2023. Source: ONS Open Geography Portal. Licensed under OGL v3.",
    slugMap: {
      "North East": "north-east",
      "North West": "north-west",
      "Yorkshire and The Humber": "yorkshire-and-the-humber",
      "East Midlands": "east-midlands",
      "West Midlands": "west-midlands",
      "East of England": "east-of-england",
      London: "greater-london",
      "South East": "south-east",
      "South West": "south-west",
    },
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchJson(url) {
  console.log(`  Fetching: ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`)

  return res.json()
}

async function fetchWithFallback(source) {
  const candidates = [
    source.url,
    ...(source.fallbackUrls ??
      (source.fallbackUrl ? [source.fallbackUrl] : [])),
  ]
  let lastErr
  for (const url of candidates) {
    try {
      return await fetchJson(url)
    } catch (err) {
      console.log(`  Failed (${err.message}), trying next candidate…`)
      lastErr = err
    }
  }
  throw lastErr
}

/**
 * Compute a bounding box from a GeoJSON feature's geometry.
 * Works for Polygon and MultiPolygon.
 */
function computeBbox(geometry) {
  const coords = []

  function collectCoords(rings) {
    for (const ring of rings) {
      for (const [lng, lat] of ring) {
        coords.push([lng, lat])
      }
    }
  }

  if (geometry.type === "Polygon") {
    collectCoords(geometry.coordinates)
  } else if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates) collectCoords(polygon)
  }

  if (!coords.length) return null

  let minLng = Infinity,
    maxLng = -Infinity
  let minLat = Infinity,
    maxLat = -Infinity

  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }

  return {
    west: Number.parseFloat(minLng.toFixed(6)),
    south: Number.parseFloat(minLat.toFixed(6)),
    east: Number.parseFloat(maxLng.toFixed(6)),
    north: Number.parseFloat(maxLat.toFixed(6)),
  }
}

/**
 * Compute centroid from bounding box midpoint.
 * Good enough for label placement and map centering.
 */
function computeCentroid(bbox) {
  return {
    lat: Number.parseFloat(((bbox.north + bbox.south) / 2).toFixed(6)),
    lng: Number.parseFloat(((bbox.east + bbox.west) / 2).toFixed(6)),
  }
}

/**
 * Resolve property value trying multiple field name candidates
 * (handles 2022 vs 2023 ONS vintage differences).
 */
function resolveField(properties, candidates) {
  for (const key of candidates) {
    if (properties[key] != null) return properties[key]
  }

  return null
}

/**
 * Normalise a raw GeoJSON FeatureCollection.
 * - Optionally filters features via sourceDef.filterFeature(feature)
 * - Strips all raw source properties
 * - Adds clean name, code, slug, bbox, centroid
 * - Returns { featureCollection, seedData }
 */
function normalise(raw, sourceKey, sourceDef) {
  const features = []
  const seedData = []

  for (const feature of raw.features) {
    // Apply optional feature filter (e.g. continent filter for Natural Earth)
    if (sourceDef.filterFeature && !sourceDef.filterFeature(feature)) continue

    const name = resolveField(feature.properties, sourceDef.nameField)
    const code = resolveField(feature.properties, sourceDef.codeField)
    const slug =
      sourceDef.slugMap?.[name] ?? name?.toLowerCase().replaceAll(/\s+/g, "-")

    if (!name || !feature.geometry) {
      console.warn(`  ⚠  Skipping feature with missing name or geometry`)
      continue
    }

    const bbox = computeBbox(feature.geometry)
    const centroid = bbox ? computeCentroid(bbox) : null

    features.push({
      type: "Feature",
      geometry: feature.geometry,
      properties: {
        name,
        code,
        slug,
      },
    })

    seedData.push({
      name,
      code,
      slug,
      centroidLat: centroid?.lat ?? null,
      centroidLng: centroid?.lng ?? null,
      bboxNorth: bbox?.north ?? null,
      bboxSouth: bbox?.south ?? null,
      bboxEast: bbox?.east ?? null,
      bboxWest: bbox?.west ?? null,
      boundaryUrl: `/boundaries/${sourceKey}.geojson`,
      sourceAttribution: sourceDef.attribution,
    })
  }

  const featureCollection = {
    type: "FeatureCollection",
    features,
  }

  return { featureCollection, seedData }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("📦  Libraries.global — Boundary Downloader\n")

  await mkdir(PUBLIC_DIR, { recursive: true })
  await mkdir(path.join(PUBLIC_DIR, "continents"), { recursive: true })
  await mkdir(path.join(PUBLIC_DIR, "countries"), { recursive: true })
  await mkdir(path.join(PUBLIC_DIR, "regions"), { recursive: true })
  await mkdir(path.join(PUBLIC_DIR, "areas"), { recursive: true })

  const allSeedData = {}
  let totalFeatures = 0

  for (const [sourceKey, sourceDef] of Object.entries(SOURCES)) {
    console.log(`\n▶  ${sourceKey}`)

    try {
      const raw = await fetchWithFallback(sourceDef)

      if (!raw.features?.length) {
        console.warn(`  ⚠  No features returned — skipping`)
        continue
      }

      console.log(`  Downloaded ${raw.features.length} features`)

      const { featureCollection, seedData } = normalise(
        raw,
        sourceKey,
        sourceDef
      )

      const outPath = path.join(PUBLIC_DIR, `${sourceKey}.geojson`)
      await writeFile(outPath, JSON.stringify(featureCollection, null, 2))

      const sizeKb = (JSON.stringify(featureCollection).length / 1024).toFixed(
        1
      )
      console.log(
        `  ✓  Saved → public/boundaries/${sourceKey}.geojson (${sizeKb} KB, ${featureCollection.features.length} features)`
      )

      allSeedData[sourceKey] = seedData
      totalFeatures += featureCollection.features.length

      // Print seed data table
      console.log(`\n  Strapi seed data for ${sourceKey}:`)
      console.log(
        `  ${"Name".padEnd(36)} ${"Slug".padEnd(30)} ${"Centroid".padEnd(22)} Bbox`
      )
      console.log(`  ${"-".repeat(110)}`)
      for (const item of seedData) {
        const centroid =
          item.centroidLat != null
            ? `${item.centroidLat.toFixed(3)}, ${item.centroidLng.toFixed(3)}`
            : "—"
        const bbox =
          item.bboxNorth != null
            ? `N${item.bboxNorth.toFixed(2)} S${item.bboxSouth.toFixed(2)} E${item.bboxEast.toFixed(2)} W${item.bboxWest.toFixed(2)}`
            : "—"
        console.log(
          `  ${item.name.padEnd(36)} ${item.slug.padEnd(30)} ${centroid.padEnd(22)} ${bbox}`
        )
      }
    } catch (err) {
      console.error(`  ✗  Failed: ${err.message}`)
    }
  }

  // Write combined seed data file
  const seedPath = path.join(PUBLIC_DIR, "seed-data.json")
  await writeFile(seedPath, JSON.stringify(allSeedData, null, 2))
  console.log(`\n✓  Seed data written → public/boundaries/seed-data.json`)
  console.log(`✓  Total features processed: ${totalFeatures}`)
  console.log(`\n📋  Next steps:`)
  console.log(
    `   1. Open Strapi admin → update each Region/Country with the values above`
  )
  console.log(
    `      (centroidLat, centroidLng, bboxNorth/South/East/West, boundaryUrl)`
  )
  console.log(
    `   2. The boundary files are served statically from /boundaries/*.geojson`
  )
  console.log(
    `   3. InteractiveMap fetches these URLs at runtime — no inline JSON needed\n`
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
