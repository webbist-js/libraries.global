import type { Core } from "@strapi/strapi"

import { isPostgres, libraryJoin, tableOf } from "./library-sql"

export type LibraryTally = {
  count: number
  /** Mean position of the child's libraries, or null when none are located. */
  center: { lat: number; lng: number } | null
}

type TallyOptions = {
  parent: "continent" | "country"
  parentDocumentId: string
  child: "country" | "region"
  locale?: string
  status: "draft" | "published"
}

type TallyRow = {
  location?: { lat?: unknown; lng?: unknown } | null
  country?: { documentId?: string } | null
  region?: { documentId?: string } | null
}

const toCoord = (value: unknown): number | null => {
  const n = typeof value === "string" ? Number.parseFloat(value) : value

  return typeof n === "number" && Number.isFinite(n) ? n : null
}

/** A jsonb coordinate as a float, only when it really is a number. */
const coordSql = (key: "lat" | "lng") =>
  `CASE WHEN jsonb_typeof(l.location->'lat') = 'number' ` +
  `AND jsonb_typeof(l.location->'lng') = 'number' ` +
  `THEN (l.location->>'${key}')::float END`

/**
 * One grouped query over the parent and child link tables (Postgres only:
 * the mean position reads the jsonb `location` column).
 */
async function tallyBySql(
  strapi: Core.Strapi,
  opts: TallyOptions
): Promise<Map<string, LibraryTally>> {
  const knex = strapi.db.connection
  const libraries = tableOf(strapi, "api::library.library")
  const parent = libraryJoin(strapi, opts.parent)
  const child = libraryJoin(strapi, opts.child)

  const query = knex(`${libraries} as l`)
    .join(`${parent.linkTable} as pl`, `pl.${parent.libraryColumn}`, "l.id")
    .join(`${parent.table} as p`, "p.id", `pl.${parent.targetColumn}`)
    .join(`${child.linkTable} as cl`, `cl.${child.libraryColumn}`, "l.id")
    .join(`${child.table} as c`, "c.id", `cl.${child.targetColumn}`)
    .where("p.document_id", opts.parentDocumentId)
  if (opts.status === "published") query.whereNotNull("l.published_at")
  else query.whereNull("l.published_at")
  if (opts.locale) query.where("l.locale", opts.locale)

  const rows = (await query
    .groupBy("c.document_id")
    .select(
      "c.document_id as child_id",
      knex.raw("count(*) as count"),
      knex.raw(`avg(${coordSql("lat")}) as lat`),
      knex.raw(`avg(${coordSql("lng")}) as lng`)
    )) as { child_id: string; count: unknown; lat: unknown; lng: unknown }[]

  return new Map(
    rows.map((row) => {
      const lat = toCoord(row.lat)
      const lng = toCoord(row.lng)

      return [
        row.child_id,
        {
          count: Number(row.count) || 0,
          center: lat !== null && lng !== null ? { lat, lng } : null,
        },
      ]
    })
  )
}

/** Loads the parent's libraries and tallies them in JS (non-Postgres). */
async function tallyByRows(
  strapi: Core.Strapi,
  opts: TallyOptions
): Promise<Map<string, LibraryTally>> {
  const tallies = new Map<
    string,
    { count: number; lat: number; lng: number; located: number }
  >()

  const rows = (await strapi.documents("api::library.library").findMany({
    filters: {
      [opts.parent]: { documentId: { $eq: opts.parentDocumentId } },
    } as never,
    fields: ["location"] as never,
    populate: { [opts.child]: { fields: ["documentId"] } } as never,
    locale: opts.locale,
    status: opts.status,
    sort: "id:asc" as never,
    limit: -1,
  })) as unknown as TallyRow[]

  for (const row of rows) {
    const childId = row[opts.child]?.documentId
    if (!childId) continue
    const entry = tallies.get(childId) ?? {
      count: 0,
      lat: 0,
      lng: 0,
      located: 0,
    }
    entry.count += 1
    const lat = toCoord(row.location?.lat)
    const lng = toCoord(row.location?.lng)
    if (lat !== null && lng !== null) {
      entry.lat += lat
      entry.lng += lng
      entry.located += 1
    }
    tallies.set(childId, entry)
  }

  return new Map(
    [...tallies].map(([id, t]) => [
      id,
      {
        count: t.count,
        center: t.located
          ? { lat: t.lat / t.located, lng: t.lng / t.located }
          : null,
      },
    ])
  )
}

/**
 * Published-library count and mean position per child location (countries of
 * a continent, regions of a country). Children with no libraries are absent
 * from the map. On Postgres this is one `GROUP BY` over the link tables; other
 * dialects (sqlite in tests) load the rows and tally in JS.
 */
export async function tallyLibrariesByChild(
  strapi: Core.Strapi,
  opts: TallyOptions
): Promise<Map<string, LibraryTally>> {
  return isPostgres(strapi)
    ? tallyBySql(strapi, opts)
    : tallyByRows(strapi, opts)
}

/** The child's own map centre when set, else the mean of its libraries. */
export function centerFor(
  mapConfig: { centerLat?: unknown; centerLng?: unknown } | null | undefined,
  tally: LibraryTally | undefined
): { lat: number; lng: number } | null {
  const lat = toCoord(mapConfig?.centerLat)
  const lng = toCoord(mapConfig?.centerLng)
  if (lat !== null && lng !== null) return { lat, lng }

  return tally?.center ?? null
}
