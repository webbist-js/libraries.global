/**
 * Publish every country in the world before go-live, so contributors never
 * meet an empty country picker.
 *
 * Reads apps/ui/public/boundaries/seed-data.json (the `continents/*` lists,
 * 247 features; mapping in ./world-countries.ts). Features with no valid
 * ISO 3166-1 alpha-2 code are skipped and listed. For each other country:
 *   - matches an existing Country by iso2, then by slug;
 *   - existing: fills only empty `iso2`, `mapConfig`, `boundaryUrl`,
 *     `sourceAttribution` and `continent`, never overwriting a value;
 *   - missing: creates it published with `name`, `slug` and those fields.
 * It also makes sure the `north-america` and `south-america` continents exist
 * (published; the seed's `americas` list is split between them, and an
 * `americas` continent is never created), then publishes every Country and
 * Region that only exists as a draft.
 *
 * Token: STRAPI_API_TOKEN must be a Strapi API token named `ingest-*`
 * (Settings → API Tokens, full access to country, region and continent).
 * The name is how ingest writes are recognised and audited; do not run this
 * with a personal or admin token.
 *
 * Run:
 *   STRAPI_URL=http://127.0.0.1:1337 STRAPI_API_TOKEN=<ingest-* token> \
 *     apps/strapi/node_modules/.bin/tsx apps/strapi/scripts/populate-world-countries.ts --dry-run
 *
 * --dry-run reads Strapi and prints the plan without writing anything.
 * Afterwards, reindex Meilisearch (node apps/strapi/scripts/seed-meilisearch.mjs).
 */

import * as fs from "node:fs"
import path from "node:path"

import {
  StrapiClient,
  type StrapiEntity,
  type StrapiListResponse,
} from "./strapi-client"
import {
  countriesFromSeed,
  iso2For,
  mapConfigFor,
  splitByIso2,
  type SeedCountry,
} from "./world-countries"

const SEED_PATH = path.resolve(
  __dirname,
  "../../ui/public/boundaries/seed-data.json"
)
const DRY_RUN = process.argv.includes("--dry-run")

const CONTINENT_NAMES: Record<string, string> = {
  africa: "Africa",
  asia: "Asia",
  europe: "Europe",
  oceania: "Oceania",
  "north-america": "North America",
  "south-america": "South America",
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface StrapiCountry extends StrapiEntity {
  name: string
  slug: string
  iso2?: string | null
  boundaryUrl?: string | null
  sourceAttribution?: string | null
  mapConfig?: Record<string, unknown> | null
  continent?: { documentId: string } | null
}

interface Summary {
  created: number
  filled: number
  skipped: number
  countriesPublished: number
  regionsPublished: number
  continentsCreated: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const isEmpty = (v: unknown) =>
  v === null || v === undefined || (typeof v === "string" && v.trim() === "")

/** documentIds that exist as a draft but have no published version. */
async function draftOnlyIds(
  client: StrapiClient,
  contentType: string
): Promise<string[]> {
  const drafts = await client.findAll(contentType, {
    status: "draft",
    fields: ["documentId"],
  })
  const published = new Set(
    (
      await client.findAll(contentType, {
        status: "published",
        fields: ["documentId"],
      })
    ).map((e) => e.documentId)
  )

  return drafts.map((e) => e.documentId).filter((id) => !published.has(id))
}

async function publishDocument(
  client: StrapiClient,
  pluralApiId: string,
  documentId: string
): Promise<void> {
  await client.put(`/${pluralApiId}/${documentId}?status=published`, {
    data: {},
  })
}

/** Ensures each continent slug exists and is published; returns slug → documentId. */
async function ensureContinents(
  client: StrapiClient,
  slugs: string[],
  summary: Summary
): Promise<Map<string, string>> {
  const bySlug = new Map<string, string>()
  const res = await client.get<StrapiListResponse<StrapiEntity>>(
    "/continents",
    {
      "fields[0]": "slug",
      "pagination[pageSize]": "100",
      status: "draft",
    }
  )
  for (const c of res.data) bySlug.set(String(c.slug), c.documentId)
  const draftOnly = new Set(await draftOnlyIds(client, "continents"))

  for (const slug of slugs) {
    if (slug === "americas") throw new Error("Refusing to use `americas`")
    const existing = bySlug.get(slug)
    if (existing) {
      if (draftOnly.has(existing)) {
        console.log(`[CONT] publish draft continent ${slug}`)
        if (!DRY_RUN) await publishDocument(client, "continents", existing)
      }
      continue
    }
    const name = CONTINENT_NAMES[slug] ?? slug
    console.log(`[CONT] create continent ${name} (${slug})`)
    summary.continentsCreated++
    if (DRY_RUN) {
      bySlug.set(slug, `(dry:${slug})`)
      continue
    }
    const created = await client.post<{ data: StrapiEntity }>(
      "/continents?status=published",
      { data: { name, slug } }
    )
    bySlug.set(slug, created.data.documentId)
  }

  return bySlug
}

/** The empty fields of an existing country that the seed can fill. */
function fillFor(
  row: StrapiCountry,
  seed: SeedCountry,
  continentId: string | undefined,
  iso2Taken: Set<string>
): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  const iso2 = iso2For(seed)
  if (isEmpty(row.iso2) && iso2 && !iso2Taken.has(iso2)) data.iso2 = iso2
  if (!row.mapConfig) data.mapConfig = mapConfigFor(seed)
  if (isEmpty(row.boundaryUrl)) data.boundaryUrl = seed.boundaryUrl
  if (isEmpty(row.sourceAttribution))
    data.sourceAttribution = seed.sourceAttribution
  if (!row.continent?.documentId && continentId)
    data.continent = { connect: [{ documentId: continentId }] }

  return data
}

function createFor(
  seed: SeedCountry,
  continentId: string | undefined,
  iso2Taken: Set<string>
): Record<string, unknown> {
  const iso2 = iso2For(seed)

  return {
    name: seed.name,
    slug: seed.slug,
    ...(iso2 && !iso2Taken.has(iso2) ? { iso2 } : {}),
    mapConfig: mapConfigFor(seed),
    boundaryUrl: seed.boundaryUrl,
    sourceAttribution: seed.sourceAttribution,
    ...(continentId
      ? { continent: { connect: [{ documentId: continentId }] } }
      : {}),
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function upsertCountries(
  client: StrapiClient,
  rows: { continentSlug: string; country: SeedCountry }[],
  continents: Map<string, string>,
  summary: Summary
): Promise<Set<string>> {
  const existing = await client.findAll<StrapiCountry>("countries", {
    status: "draft",
    populate: ["mapConfig", "continent"],
  })
  const byIso2 = new Map<string, StrapiCountry>()
  const bySlug = new Map<string, StrapiCountry>()
  for (const row of existing) {
    if (!isEmpty(row.iso2)) byIso2.set(String(row.iso2).toUpperCase(), row)
    bySlug.set(row.slug, row)
  }
  const iso2Taken = new Set(byIso2.keys())
  const touched = new Set<string>()

  for (const { continentSlug, country } of rows) {
    const iso2 = iso2For(country)
    const match = (iso2 && byIso2.get(iso2)) || bySlug.get(country.slug)
    const continentId = continents.get(continentSlug)

    if (!match) {
      const data = createFor(country, continentId, iso2Taken)
      console.log(
        `[NEW]  ${country.name} (${country.slug}, ${iso2 ?? "no iso2"}) → ${continentSlug}`
      )
      summary.created++
      if (data.iso2) iso2Taken.add(String(data.iso2))
      if (!DRY_RUN) {
        const created = await client.post<{ data: StrapiEntity }>(
          "/countries?status=published",
          { data }
        )
        touched.add(created.data.documentId)
      }
      continue
    }

    const data = fillFor(match, country, continentId, iso2Taken)
    const keys = Object.keys(data)
    if (keys.length === 0) {
      summary.skipped++
      continue
    }
    console.log(`[FILL] ${match.name} (${match.slug}): ${keys.join(", ")}`)
    summary.filled++
    if (data.iso2) iso2Taken.add(String(data.iso2))
    touched.add(match.documentId)
    if (!DRY_RUN)
      await client.put(`/countries/${match.documentId}?status=published`, {
        data,
      })
  }

  return touched
}

async function publishDrafts(
  client: StrapiClient,
  pluralApiId: string,
  alreadyPublished: Set<string>
): Promise<number> {
  const ids = (await draftOnlyIds(client, pluralApiId)).filter(
    (id) => !alreadyPublished.has(id)
  )
  for (const id of ids) {
    if (!DRY_RUN) await publishDocument(client, pluralApiId, id)
  }
  console.log(
    `[PUB]  ${DRY_RUN ? "would publish" : "published"} ${ids.length} draft ${pluralApiId}`
  )

  return ids.length
}

async function main() {
  if (DRY_RUN) console.log("DRY RUN: no writes will be made\n")

  const seed = JSON.parse(fs.readFileSync(SEED_PATH, "utf8")) as Record<
    string,
    unknown
  >
  const { importable: rows, skipped: noIso } = splitByIso2(
    countriesFromSeed(seed)
  )
  console.log(
    `Seed: ${rows.length + noIso.length} features, ${rows.length} with an ISO code\n`
  )

  const client = new StrapiClient()
  const summary: Summary = {
    created: 0,
    filled: 0,
    skipped: 0,
    countriesPublished: 0,
    regionsPublished: 0,
    continentsCreated: 0,
  }

  const continentSlugs = [...new Set(rows.map((r) => r.continentSlug))]
  for (const required of ["north-america", "south-america"])
    if (!continentSlugs.includes(required)) continentSlugs.push(required)
  const continents = await ensureContinents(client, continentSlugs, summary)

  // Draft-only countries that were filled were published by that write.
  const draftCountriesBefore = new Set(await draftOnlyIds(client, "countries"))
  const touched = await upsertCountries(client, rows, continents, summary)
  const publishedByFill = new Set(
    [...touched].filter((id) => draftCountriesBefore.has(id))
  )

  summary.countriesPublished =
    publishedByFill.size +
    (await publishDrafts(client, "countries", publishedByFill))
  summary.regionsPublished = await publishDrafts(client, "regions", new Set())

  console.log(`
─────────────────────────────────────────
${DRY_RUN ? "DRY RUN (nothing written)" : "Done"}
Continents created  : ${summary.continentsCreated}
Countries created   : ${summary.created}
Countries filled    : ${summary.filled}
Countries skipped   : ${summary.skipped} (already complete)
Countries published : ${summary.countriesPublished} (were draft only)
Regions published   : ${summary.regionsPublished} (were draft only)
Features skipped    : ${noIso.length} (no ISO code)
─────────────────────────────────────────`)

  console.log(`\nSKIPPED (no ISO code): ${noIso.length}`)
  for (const { country } of noIso)
    console.log(
      `  - ${country.name} (${country.slug}, seed code ${country.code})`
    )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
