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

// ── GADM admin-1 sources for European countries ───────────────────────────────
// GADM 4.1 — free for non-commercial/educational use. https://gadm.org/license.html
// Each entry downloads level-1 admin divisions (states/provinces/regions) for
// one country and writes it to countries/{slug}.geojson.
// The GBR level-2 entries extract Scotland / Wales / Northern Ireland sub-regions.

const GADM_ATTRIBUTION =
  "GADM data. https://gadm.org/. License: Free for non-commercial use."

// GADM URL for a given ISO-3 code and admin level
const gadmUrl = (iso3, level = 1) =>
  `https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_${iso3}_${level}.json`

// Splits CamelCase names that GADM sometimes produces (e.g. "AberdeenCity" → "Aberdeen City")
function splitCamelCase(str) {
  if (!str.includes(" ") && str.length > 3 && /[a-z][A-Z]/.test(str)) {
    return str.replace(/([a-z])([A-Z])/g, "$1 $2")
  }
  return str
}

/**
 * EU country entries. Each key becomes the output path (countries/{slug}.geojson).
 * iso3: GADM ISO-3 code. regionTypeLabel: human label for Strapi (informational only).
 */
const EU_GADM_COUNTRIES = [
  { slug: "albania",               iso3: "ALB" },
  { slug: "austria",               iso3: "AUT" },
  { slug: "belarus",               iso3: "BLR" },
  { slug: "belgium",               iso3: "BEL" },
  { slug: "bosnia-and-herzegovina",iso3: "BIH" },
  { slug: "bulgaria",              iso3: "BGR" },
  { slug: "croatia",               iso3: "HRV" },
  { slug: "cyprus",                iso3: "CYP" },
  { slug: "czechia",               iso3: "CZE" },
  { slug: "denmark",               iso3: "DNK" },
  { slug: "estonia",               iso3: "EST" },
  { slug: "finland",               iso3: "FIN" },
  { slug: "france",                iso3: "FRA" },
  { slug: "germany",               iso3: "DEU" },
  { slug: "greece",                iso3: "GRC" },
  { slug: "hungary",               iso3: "HUN" },
  { slug: "iceland",               iso3: "ISL" },
  { slug: "republic-of-ireland",   iso3: "IRL" },
  { slug: "italy",                 iso3: "ITA" },
  { slug: "latvia",                iso3: "LVA" },
  { slug: "lithuania",             iso3: "LTU" },
  { slug: "moldova",               iso3: "MDA" },
  { slug: "montenegro",            iso3: "MNE" },
  { slug: "netherlands",           iso3: "NLD" },
  { slug: "north-macedonia",       iso3: "MKD" },
  { slug: "norway",                iso3: "NOR" },
  { slug: "poland",                iso3: "POL" },
  { slug: "portugal",              iso3: "PRT" },
  { slug: "romania",               iso3: "ROU" },
  { slug: "serbia",                iso3: "SRB" },
  { slug: "slovakia",              iso3: "SVK" },
  { slug: "slovenia",              iso3: "SVN" },
  { slug: "spain",                 iso3: "ESP" },
  { slug: "sweden",                iso3: "SWE" },
  { slug: "switzerland",           iso3: "CHE" },
  { slug: "ukraine",               iso3: "UKR" },
  // Kosovo — GADM uses XKX
  { slug: "kosovo",                iso3: "XKO" },
]

// GBR L1 GID values for each devolved nation (from GADM 4.1)
const GBR_NATION_GID = {
  scotland:         "GBR.3_1",
  wales:            "GBR.4_1",
  "northern-ireland": "GBR.2_1",
}

/**
 * nameMap: raw GADM name → { name: corrected display name, slug: correct slug }
 * Used to fix GADM names that drop spaces (e.g. "Argylland Bute").
 * The corrected name goes into properties.name; the slug into properties.slug.
 */
const GADM_NAME_CORRECTIONS = {
  // France — GADM drops spaces in compound region names
  "Centre-Valde Loire":          { name: "Centre-Val de Loire",       slug: "centre-val-de-loire" },
  "Paysdela Loire":              { name: "Pays de la Loire",           slug: "pays-de-la-loire" },
  "Provence-Alpes-Côted'Azur":   { name: "Provence-Alpes-Côte d'Azur",slug: "provence-alpes-cote-dazur" },
  // Scotland — GADM drops spaces before "and" / "of"
  "Argylland Bute":              { name: "Argyll and Bute",            slug: "argyll-and-bute" },
  "Cityof Edinburgh":            { name: "City of Edinburgh",          slug: "city-of-edinburgh" },
  "Dumfriesand Galloway":        { name: "Dumfries and Galloway",      slug: "dumfries-and-galloway" },
  "Perthand Kinross":            { name: "Perth and Kinross",          slug: "perth-and-kinross" },
  // Wales
  "Isleof Anglesey":             { name: "Isle of Anglesey",           slug: "isle-of-anglesey" },
  // Northern Ireland — all 11 districts have missing spaces
  "Antrimand Newtownabbey":      { name: "Antrim and Newtownabbey",    slug: "antrim-and-newtownabbey" },
  "Ardsand North Down":          { name: "Ards and North Down",        slug: "ards-and-north-down" },
  "Armagh City,Banbridgeand Craig": { name: "Armagh City, Banbridge and Craigavon", slug: "armagh-city-banbridge-and-craigavon" },
  "Derry Cityand Strabane":      { name: "Derry City and Strabane",    slug: "derry-city-and-strabane" },
  "Fermanaghand Omagh":          { name: "Fermanagh and Omagh",        slug: "fermanagh-and-omagh" },
  "Midand East Antrim":          { name: "Mid and East Antrim",        slug: "mid-and-east-antrim" },
  "Newry,Mourneand Down":        { name: "Newry, Mourne and Down",     slug: "newry-mourne-and-down" },
  // Northern Ireland districts with no issues (listed for completeness)
  "Belfast":                     { name: "Belfast",                    slug: "belfast" },
  "Causewaycoastand Glens":      { name: "Causeway Coast and Glens",   slug: "causeway-coast-and-glens" },
  "Lisburn Cityand Castlereagh": { name: "Lisburn City and Castlereagh",slug: "lisburn-city-and-castlereagh" },
  "Mid Ulster":                  { name: "Mid Ulster",                 slug: "mid-ulster" },
}

// Inject GADM country sources into SOURCES
for (const { slug, iso3 } of EU_GADM_COUNTRIES) {
  SOURCES[`countries/${slug}`] = {
    url: gadmUrl(iso3, 1),
    nameField: ["NAME_1"],
    codeField: ["HASC_1"],
    attribution: GADM_ATTRIBUTION,
    formatName: splitCamelCase,
    nameMap: GADM_NAME_CORRECTIONS,
  }
}

// Scotland, Wales, Northern Ireland — Level 2 GBR filtered by parent GID
for (const [slug, parentGid] of Object.entries(GBR_NATION_GID)) {
  SOURCES[`countries/${slug}`] = {
    url: gadmUrl("GBR", 2),
    nameField: ["NAME_2"],
    codeField: ["HASC_2"],
    filterFeature: (f) => f.properties?.GID_1 === parentGid,
    attribution: GADM_ATTRIBUTION,
    formatName: splitCamelCase,
    nameMap: GADM_NAME_CORRECTIONS,
  }
}

// Northern Ireland: two districts have NAME_2="NA" in GADM — resolve by HASC_2 code
SOURCES["countries/northern-ireland"].featureCodeMap = {
  "GB.CJ": { name: "Causeway Coast and Glens",    slug: "causeway-coast-and-glens" },
  "GB.LH": { name: "Lisburn City and Castlereagh", slug: "lisburn-city-and-castlereagh" },
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
function slugifyName(name) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .replace(/[ß]/g, "ss")
    .replace(/[łŁ]/g, "l")
    .replace(/[øØ]/g, "o")
    .replace(/[æÆ]/g, "ae")
    .replace(/[đĐ]/g, "d")
    .replace(/[þÞ]/g, "th")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
}

function normalise(raw, sourceKey, sourceDef) {
  const features = []
  const seedData = []

  for (const feature of raw.features) {
    // Apply optional feature filter (e.g. continent filter for Natural Earth)
    if (sourceDef.filterFeature && !sourceDef.filterFeature(feature)) continue

    let name = resolveField(feature.properties, sourceDef.nameField)
    if (name && sourceDef.formatName) name = sourceDef.formatName(name)
    const code = resolveField(feature.properties, sourceDef.codeField)

    // Lookup by code first (handles features with name="NA" in GADM)
    const codeOverride = code ? sourceDef.featureCodeMap?.[code] : null
    const correction = codeOverride ?? sourceDef.nameMap?.[name]
    if (correction) name = correction.name

    // Skip features with no usable name
    if (!name || name === "NA") continue

    const slug =
      correction?.slug ??
      sourceDef.slugMap?.[name] ??
      (name ? slugifyName(name) : null)

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
