/**
 * Reads all boundary GeoJSON files from apps/ui/public/boundaries/countries/
 * and for each file:
 *   1. Finds the matching Country record in Strapi by slug
 *   2. Sets Country.boundaryUrl = /boundaries/countries/{slug}.geojson
 *   3. Creates or updates Region records for every feature in the GeoJSON,
 *      each with boundaryUrl pointing to the same country file
 *
 * Run:
 *   STRAPI_API_TOKEN=$(grep -oP '(?<=STRAPI_API_TOKEN=).+' apps/strapi/.env) \
 *     apps/strapi/node_modules/.bin/tsx apps/strapi/scripts/populate-eu-boundaries.ts
 *
 * Add --dry-run to log actions without writing to Strapi.
 */

import * as fs from "node:fs"
import path from "node:path"

import { StrapiClient } from "./strapi-client"

const BOUNDARIES_DIR = path.resolve(
  __dirname,
  "../../ui/public/boundaries/countries"
)
const STRAPI_URL = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN ?? ""
const DRY_RUN = process.argv.includes("--dry-run")

if (!STRAPI_API_TOKEN) {
  console.error("STRAPI_API_TOKEN is not set.")
  process.exit(1)
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface GeoFeatureProps {
  name: string
  slug: string
  code: string
}

interface GeoJSON {
  type: "FeatureCollection"
  features: { type: "Feature"; properties: GeoFeatureProps }[]
}

interface StrapiCountry {
  documentId: string
  name: string
  continent?: { documentId: string; name: string }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function apiGet<T>(
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${STRAPI_URL}/api${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
  })
  if (!res.ok) throw new Error(`GET ${url} → ${res.status} ${await res.text()}`)

  return res.json() as Promise<T>
}

async function fetchCountryWithContinent(
  slug: string
): Promise<StrapiCountry | null> {
  const res = await apiGet<{ data: StrapiCountry[] }>("/countries", {
    "filters[slug][$eq]": slug,
    "fields[0]": "documentId",
    "fields[1]": "name",
    "populate[0]": "continent",
    "pagination[limit]": "1",
    status: "draft",
  })

  return res.data[0] ?? null
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) console.log("DRY RUN — no writes will be made\n")

  const client = new StrapiClient()

  const files = fs
    .readdirSync(BOUNDARIES_DIR)
    .filter((f) => f.endsWith(".geojson"))
    .sort()

  let countriesUpdated = 0
  let regionsCreated = 0
  let countriesMissed = 0

  for (const file of files) {
    const countrySlug = file.replace(".geojson", "")
    const boundaryUrl = `/boundaries/countries/${file}`

    // Load GeoJSON features
    const geojson: GeoJSON = JSON.parse(
      fs.readFileSync(path.join(BOUNDARIES_DIR, file), "utf8")
    )
    const regions = geojson.features
      .map((f) => f.properties)
      .filter((p) => p.slug && p.name && p.name !== "?")

    if (regions.length === 0) {
      console.log(`[SKIP] ${countrySlug} — no valid region features`)
      continue
    }

    // Find country in Strapi
    const country = await fetchCountryWithContinent(countrySlug)
    if (!country) {
      console.log(
        `[MISS] ${countrySlug} — country not found in Strapi (skipping)`
      )
      countriesMissed++
      continue
    }

    const countryDocId = country.documentId
    const continentDocId = country.continent?.documentId

    if (!continentDocId) {
      console.warn(
        `[WARN] ${countrySlug} — no continent linked; regions will be created without continent`
      )
    }

    // Update country boundaryUrl
    if (!DRY_RUN) {
      await client.updateCountry(countryDocId, { boundaryUrl })
    }
    console.log(
      `[CTY]  ${DRY_RUN ? "(dry) " : ""}${country.name} (${countrySlug}) → boundaryUrl set — ${regions.length} region(s)`
    )
    countriesUpdated++

    // Create / update each region
    for (const region of regions) {
      if (DRY_RUN) {
        console.log(`  [REG] (dry) ${region.name} [${region.slug}]`)
        continue
      }

      const docId = await client.findOrCreateRegion(
        region.name,
        region.slug,
        countryDocId,
        continentDocId ?? "",
        { boundaryUrl }
      )

      // Patch boundaryUrl — covers existing regions that predate this script.
      // Slug uniqueness errors (e.g. two countries sharing a slug) are non-fatal: the region
      // was already created with the correct boundaryUrl in findOrCreateRegion's extra param.
      try {
        await client.updateRegion(docId, { boundaryUrl })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes("must be unique") || msg.includes("ValidationError")) {
          console.warn(
            `  [WARN] Could not update boundaryUrl for ${region.name} [${region.slug}] — slug conflict, boundaryUrl set on create`
          )
        } else {
          throw err
        }
      }
    }

    if (!DRY_RUN) {
      console.log(`  ↳ ${regions.length} region(s) created/updated`)
      regionsCreated += regions.length
    }
  }

  console.log(`
─────────────────────────────────────────
Countries updated : ${countriesUpdated}
Countries missed  : ${countriesMissed}
Regions processed : ${DRY_RUN ? "(dry run)" : regionsCreated}
─────────────────────────────────────────`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
