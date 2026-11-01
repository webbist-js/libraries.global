import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"

const requireDatabase = createRequire(require.resolve("@strapi/database"))
const createKnex = requireDatabase("knex")
const storage = requireDatabase(
  path.resolve(
    __dirname,
    "../../../database/migrations/shared/population-storage"
  )
)

export interface OwnedPopulation {
  table: "countries" | "regions" | "areas"
  documentId: string
  iso2: string
  observation: Record<string, unknown>
}

/** Explicit document ownership lets country adapters reuse the population store. */
export async function storeOwnedPopulation(knex: any, rows: OwnedPopulation[]) {
  return knex.transaction(async (trx: any) => {
    if (
      !(await trx.raw("SELECT pg_try_advisory_xact_lock(7420107) AS locked"))
        .rows[0].locked
    )
      throw new Error("Population import already running")
    const keys = new Set<string>()
    const plan = []
    for (const row of rows) {
      if (!["countries", "regions", "areas"].includes(row.table))
        throw new Error("Invalid population owner table")
      const observation = storage.normalizeObservation(row.observation)
      if (keys.has(observation.key))
        throw new Error(`Duplicate population estimate ${observation.key}`)
      keys.add(observation.key)
      // Lock all versions. Population-only writes never alter timestamps, text or publication state.
      const versions = await trx(row.table)
        .where({ document_id: row.documentId })
        .select("*")
        .forUpdate()
      const english = versions.filter((place: any) => place.locale === "en")
      const place =
        english.find((version: any) => version.published_at) ?? english[0]
      if (!place)
        throw new Error(`Population owner ${row.documentId} is missing`)
      if (row.table === "countries") {
        if (place.iso_2 !== row.iso2)
          throw new Error("Population country ownership mismatch")
      } else {
        const linked = await trx(`${row.table}_country_lnk as l`)
          .join("countries as c", "c.id", "l.country_id")
          .where(
            `l.${row.table === "areas" ? "area_id" : "region_id"}`,
            place.id
          )
          .where("c.iso_2", row.iso2)
          .first()
        if (!linked)
          throw new Error(
            `Population place ${row.documentId} is not in ${row.iso2}`
          )
      }
      plan.push({ observation, owner: { table: row.table, place } })
    }

    return storage.storePopulationPlan(trx, plan)
  })
}

export function ingestDatabase() {
  const ssl =
    process.env.DATABASE_SSL === "true"
      ? {
          ...(process.env.DATABASE_SSL_CA_FILE
            ? { ca: readFileSync(process.env.DATABASE_SSL_CA_FILE, "utf8") }
            : {}),
          ...(process.env.DATABASE_SSL_SERVERNAME
            ? { servername: process.env.DATABASE_SSL_SERVERNAME }
            : {}),
          rejectUnauthorized:
            process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false",
        }
      : false

  return createKnex({
    client: "pg",
    connection: process.env.DATABASE_URL
      ? { connectionString: process.env.DATABASE_URL, ssl }
      : {
          host: process.env.DATABASE_HOST ?? "127.0.0.1",
          port: Number(process.env.DATABASE_PORT ?? 5432),
          database: process.env.DATABASE_NAME ?? "strapi",
          user: process.env.DATABASE_USERNAME ?? "strapi",
          password: process.env.DATABASE_PASSWORD ?? "strapi",
          ssl,
        },
    searchPath: [process.env.DATABASE_SCHEMA ?? "public"],
    pool: { min: 0, max: 2 },
    acquireConnectionTimeout: 10000,
  })
}

/** Public REST projections omit reporting codes; read only identifiers for the ingest. */
export async function placeReportingCodes(knex: any, iso2: string[]) {
  const codes = new Map<string, string>()
  for (const table of ["regions", "areas"]) {
    const rows = await knex(`${table} as p`)
      .join(
        `${table}_country_lnk as l`,
        `l.${table === "areas" ? "area_id" : "region_id"}`,
        "p.id"
      )
      .join("countries as c", "c.id", "l.country_id")
      .whereIn("c.iso_2", iso2)
      .where("p.locale", "en")
      .whereNotNull("p.population_reporting_code")
      .select("p.document_id", "p.population_reporting_code")
    for (const row of rows) {
      const previous = codes.get(row.document_id)
      if (previous && previous !== row.population_reporting_code)
        throw new Error(`Conflicting reporting codes on ${row.document_id}`)
      codes.set(row.document_id, row.population_reporting_code)
    }
  }

  return codes
}
