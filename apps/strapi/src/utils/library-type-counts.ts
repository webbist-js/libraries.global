import { DEFAULT_LOCALE, DEFAULT_LIBRARY_TYPES } from "@repo/shared-data"
import type { Core } from "@strapi/strapi"

import { isPostgres, libraryJoin } from "./library-sql"
import {
  canonicalPlaceLibraries,
  scopePlaceQuery,
  PLACE_LIBRARY_FILTERS,
} from "./place-library-scope"

type Relation = "continent" | "country" | "region"
type CountOptions = { locale?: string; status: "draft" | "published" }
type TypeCount = { type: string; count: number }

const finish = (counts: TypeCount[]) =>
  counts.filter((c) => c.count > 0).sort((a, b) => b.count - a.count)

/** One grouped query over the location and type relations (Postgres). */
async function countBySql(
  strapi: Core.Strapi,
  relation: Relation,
  documentId: string,
  opts: CountOptions
): Promise<TypeCount[]> {
  const knex = strapi.db.connection
  const type = libraryJoin(strapi, "libraryType")
  const query = scopePlaceQuery(
    canonicalPlaceLibraries(strapi, opts.locale, opts.status, {
      relation,
      documentId,
    }),
    strapi,
    relation,
    documentId
  )

  const rows = (await query
    .leftJoin(`${type.linkTable} as tl`, `tl.${type.libraryColumn}`, "l.id")
    .leftJoin(`${type.table} as lt`, "lt.id", `tl.${type.targetColumn}`)
    .groupBy("lt.name")
    .select("lt.name as type", knex.raw("count(*) as count"))) as {
    type: string | null
    count: unknown
  }[]

  return finish(
    rows.flatMap((row) =>
      row.type ? [{ type: row.type, count: Number(row.count) || 0 }] : []
    )
  )
}

/** One count per type through the Document Service (non-Postgres). */
async function countByType(
  strapi: Core.Strapi,
  relation: Relation,
  documentId: string,
  opts: CountOptions
): Promise<TypeCount[]> {
  const catalogue = await strapi
    .documents("api::library-type.library-type")
    .findMany({ status: "published", fields: ["name"], limit: 1000 })
  const types = [
    ...new Set([
      ...DEFAULT_LIBRARY_TYPES,
      ...catalogue.map((entry) => entry.name),
    ]),
  ]
  const counts = await Promise.all(
    types.map(async (type) => {
      const count = await strapi.documents("api::library.library").count({
        filters: {
          [relation]: { documentId: { $eq: documentId } },
          libraryType: { name: { $eq: type } },
          ...PLACE_LIBRARY_FILTERS,
        } as never,
        locale: DEFAULT_LOCALE,
        status: opts.status,
      })

      return { type, count }
    })
  )

  return finish(counts)
}

/**
 * Published-library counts per `libraryType` for one location, largest first,
 * zero counts dropped. Feeds programmatic copy and meta descriptions on the
 * continent / country / region pages. On Postgres it is a single grouped
 * query; elsewhere one count per type.
 */
export async function countLibrariesByType(
  strapi: Core.Strapi,
  relation: Relation,
  documentId: string,
  opts: CountOptions
): Promise<TypeCount[]> {
  return isPostgres(strapi)
    ? countBySql(strapi, relation, documentId, opts)
    : countByType(strapi, relation, documentId, opts)
}
