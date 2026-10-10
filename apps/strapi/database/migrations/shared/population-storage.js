"use strict"

const { randomUUID } = require("node:crypto")

const TABLES = ["countries", "regions", "areas", "continents", "site_configs"]
const BOT = {
  actorId: "libraries-global-bot",
  actorName: "Libraries Global bot",
}
const MISSING_COUNTRIES = {
  MDV: { iso2: "MV", name: "Maldives", slug: "maldives", continent: "asia" },
  MUS: {
    iso2: "MU",
    name: "Mauritius",
    slug: "mauritius",
    continent: "africa",
  },
  SYC: {
    iso2: "SC",
    name: "Seychelles",
    slug: "seychelles",
    continent: "africa",
  },
}

function json(value) {
  return typeof value === "string" ? JSON.parse(value) : value
}

function placeName(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replaceAll(/[\p{M}\P{L}]/gu, "")
    .replace("rhonddacynontaff", "rhonddacynontaf")
}

function canonical(rows) {
  const byId = new Map()
  for (const row of rows) {
    const previous = byId.get(row.document_id)
    if (!previous || (!previous.published_at && row.published_at))
      byId.set(row.document_id, row)
  }

  return [...byId.values()]
}

/** Load both drafts and published rows; ownership is one document, regardless of version. */
async function loadPlaces(knex) {
  const countries = canonical(
    await knex("countries").where({ locale: "en" }).select("*")
  )
  const continents = canonical(
    await knex("continents").where({ locale: "en" }).select("*")
  )
  const local = async (table, link, id) =>
    canonical(
      await knex(`${table} as p`)
        .join(`${link} as l`, `l.${id}`, "p.id")
        .join("countries as c", "c.id", "l.country_id")
        .where("p.locale", "en")
        .whereIn("c.iso_2", ["GB-ENG", "GB-SCT", "GB-WLS", "GB-NIR", "GB"])
        .select("p.*", "c.iso_2 as country_iso2")
    )

  return {
    countries,
    continents,
    regions: await local("regions", "regions_country_lnk", "region_id"),
    areas: await local("areas", "areas_country_lnk", "area_id"),
    site: await knex("site_configs").first(),
  }
}

function one(candidates, observation) {
  if (candidates.length !== 1)
    throw new Error(
      `Population ${observation.key}: expected one geographic owner, found ${candidates.length}`
    )

  return candidates[0]
}

function ownerFor(observation, places) {
  if (observation.level === "world")
    return { table: "site_configs", place: places.site ?? null }
  if (observation.level === "country") {
    const alias = { GBR: "GB-ENG", CHI: "GG" }[observation.reportingCode]
    const matches = places.countries.filter((p) =>
      alias
        ? p.iso_2 === alias
        : p.iso_3 === observation.reportingCode ||
          (observation.iso2 && p.iso_2 === observation.iso2)
    )
    if (!matches.length && MISSING_COUNTRIES[observation.reportingCode])
      return {
        table: "countries",
        missing: MISSING_COUNTRIES[observation.reportingCode],
      }

    return {
      table: "countries",
      place: one(matches, observation),
      parent: !!alias,
    }
  }
  if (["area", "region"].includes(observation.level)) {
    const nation = { E: "GB-ENG", S: "GB-SCT", W: "GB-WLS", N: "GB-NIR" }[
      observation.reportingCode[0]
    ]
    if (!nation)
      throw new Error(
        `Unsupported population reporting code ${observation.reportingCode}`
      )
    const tables =
      observation.level === "region" ? ["regions"] : ["areas", "regions"]
    const candidates = tables.flatMap((table) =>
      places[table]
        .filter((p) => p.country_iso2 === nation || p.country_iso2 === "GB")
        .map((place) => ({ table, place }))
    )
    const coded = candidates.filter(
      (p) => p.place.gss_code === observation.reportingCode
    )
    if (coded.length) return one(coded, observation)
    const named = candidates.filter(
      (p) => placeName(p.place.name) === placeName(observation.name)
    )

    return one(named, observation)
  }
  if (observation.level === "continent")
    return {
      table: "continents",
      place: one(
        places.continents.filter(
          (p) =>
            p.slug === observation.reportingCode ||
            p.code === observation.reportingCode
        ),
        observation
      ),
    }
  throw new Error(`Unsupported population level ${observation.level}`)
}

function normalizeObservation(row) {
  const value = row.population == null ? null : Number(row.population)
  if (
    (value !== null && (!Number.isSafeInteger(value) || value <= 0)) ||
    !Number.isInteger(row.year) ||
    row.year < 1900 ||
    row.year > 2100 ||
    !row.key ||
    !row.reportingCode ||
    !row.source ||
    !row.sourceUrl ||
    !row.licence ||
    !Number.isFinite(Date.parse(row.retrievedAt))
  )
    throw new Error(`Invalid stored population estimate ${row.key}`)

  return {
    ...row,
    population: value,
    retrievedAt: new Date(row.retrievedAt).toISOString(),
    ...BOT,
  }
}

/** Validate every mapping before writing anything. New places are explicitly enumerated. */
async function populationPlan(knex, observations) {
  const places = await loadPlaces(knex)
  const keys = new Set()

  return observations.map((input) => {
    const observation = normalizeObservation(input)
    if (keys.has(observation.key))
      throw new Error(`Duplicate population estimate ${observation.key}`)
    keys.add(observation.key)
    const owner = ownerFor(observation, places)
    if (owner.missing)
      owner.continent = one(
        places.continents.filter((p) => p.slug === owner.missing.continent),
        observation
      )

    return { observation, owner }
  })
}

function derivedFields(observation, table) {
  if (table === "site_configs") return {}

  return {
    [table === "countries" ? "population_count" : "population"]:
      observation.population,
    population_year: observation.year,
    population_source: observation.source,
    population_source_url: observation.sourceUrl,
    population_licence: observation.licence,
    population_retrieved_at: observation.retrievedAt,
    population_reporting_code: observation.reportingCode,
    population_method: observation.method,
    population_coverage: JSON.stringify({
      complete: observation.population !== null,
      ...(observation.boundaryVersion
        ? { boundaryVersion: observation.boundaryVersion }
        : {}),
      ...(observation.parentReportingCode
        ? { parentReportingCode: observation.parentReportingCode }
        : {}),
    }),
  }
}

/** Called inside the caller's transaction. Never publishes unrelated draft edits. */
async function storePopulationPlan(knex, plan) {
  const owners = new Map()
  for (const { observation, owner } of plan) {
    let place = owner.place
    if (owner.missing) {
      const prior = owners.get(`countries:new:${observation.reportingCode}`)
      if (prior) place = prior.place
      else {
        const documentId = randomUUID().replaceAll("-", "").slice(0, 24)
        const now = new Date()
        const data = {
          document_id: documentId,
          locale: "en",
          name: owner.missing.name,
          slug: owner.missing.slug,
          iso_2: owner.missing.iso2,
          iso_3: observation.reportingCode,
          entity_ref: `${owner.continent.slug}:${owner.missing.slug}`,
          created_at: now,
          updated_at: now,
          source_attribution: `${observation.source}. ${observation.sourceUrl}. ${observation.licence}.`,
        }
        for (const published_at of [null, now]) {
          const [created] = await knex("countries")
            .insert({ ...data, published_at })
            .returning("*")
          await knex("countries_continent_lnk").insert({
            country_id: created.id,
            continent_id: owner.continent.id,
          })
          place = created
        }
      }
    }
    if (!place && owner.table === "site_configs") {
      place = await knex("site_configs").first()
      if (!place) {
        const [created] = await knex("site_configs")
          .insert({
            document_id: randomUUID().replaceAll("-", "").slice(0, 24),
            created_at: new Date(),
            updated_at: new Date(),
            published_at: new Date(),
          })
          .returning("*")
        place = created
      }
    }
    const key = owner.missing
      ? `countries:new:${observation.reportingCode}`
      : `${owner.table}:${place.document_id}`
    const group = owners.get(key) ?? {
      table: owner.table,
      place,
      rows: [],
      parent: owner.parent,
    }
    group.rows.push(observation)
    owners.set(key, group)
  }
  for (const { table, place, rows, parent } of owners.values()) {
    const estimates = json(place.population_estimates) ?? []
    if (!Array.isArray(estimates))
      throw new Error("Invalid place population estimates")
    const byKey = new Map(estimates.map((row) => [row.key, row]))
    for (const row of rows) byKey.set(row.key, row)
    const values = [...byKey.values()].sort((a, b) =>
      a.key.localeCompare(b.key)
    )
    const latest = [...values].sort((a, b) => b.year - a.year)[0]
    const data = { population_estimates: JSON.stringify(values) }
    if (!parent && table !== "site_configs")
      Object.assign(data, derivedFields(latest, table))
    if (["areas", "regions"].includes(table))
      data.gss_code = latest.reportingCode
    await knex(table).where({ document_id: place.document_id }).update(data)
  }

  return { estimates: plan.length, places: owners.size }
}

async function ensurePopulationColumns(knex) {
  for (const table of TABLES)
    if (
      (await knex.schema.hasTable(table)) &&
      !(await knex.schema.hasColumn(table, "population_estimates"))
    )
      await knex.schema.alterTable(table, (t) =>
        t.jsonb("population_estimates")
      )
  if (await knex.schema.hasTable("regions")) {
    if (!(await knex.schema.hasColumn("regions", "gss_code")))
      await knex.schema.alterTable("regions", (t) => t.string("gss_code"))
    await knex.raw("ALTER TABLE regions ALTER COLUMN population TYPE bigint")
  }
}

async function readPopulationEstimates(knex, tables, predicate) {
  const estimates = new Map()
  for (const table of tables) {
    const rows = await knex(table)
      .where({ locale: "en" })
      .whereNotNull("published_at")
      .whereNotNull("population_estimates")
      .select("population_estimates")
      .limit(1025)
    if (rows.length > 1024)
      throw new Error("Population place catalogue exceeds budget")
    for (const row of rows)
      for (const value of json(row.population_estimates) ?? []) {
        if (!predicate(value)) continue
        const estimate = normalizeObservation(value)
        const prior = estimates.get(estimate.key)
        if (prior && JSON.stringify(prior) !== JSON.stringify(estimate))
          throw new Error(`Conflicting population estimate ${estimate.key}`)
        estimates.set(estimate.key, estimate)
      }
  }

  return [...estimates.values()].sort((a, b) => a.key.localeCompare(b.key))
}

async function retirePopulationIndexRegistration(knex) {
  if (!(await knex.schema.hasTable("strapi_core_store_settings"))) return
  const keys = [
    "plugin_meilisearch_meilisearch_listened_content_types",
    "plugin_meilisearch_meilisearch_indexed_content_types",
  ]
  for (const row of await knex("strapi_core_store_settings").whereIn(
    "key",
    keys
  )) {
    const types = json(row.value)
    if (!Array.isArray(types))
      throw new Error("Invalid Meilisearch content-type registration")
    await knex("strapi_core_store_settings")
      .where({ id: row.id })
      .update({
        value: JSON.stringify(
          types.filter(
            (uid) =>
              uid !== "api::population-observation.population-observation"
          )
        ),
      })
  }
}

module.exports = {
  populationPlan,
  storePopulationPlan,
  ensurePopulationColumns,
  readPopulationEstimates,
  normalizeObservation,
  placeName,
  retirePopulationIndexRegistration,
}
