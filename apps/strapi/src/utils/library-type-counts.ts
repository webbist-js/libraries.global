import { DEFAULT_LOCALE } from "@repo/shared-data"
import type { Core } from "@strapi/strapi"

import { isPostgres } from "./library-sql"
import {
  canonicalPlaceLibraries,
  scopePlaceQuery,
  PLACE_LIBRARY_FILTERS,
} from "./place-library-scope"

import librarySchema from "../api/library/content-types/library/schema.json"

const LIBRARY_TYPES = librarySchema.attributes.libraryType.enum as string[]

type Relation = "continent" | "country" | "region"
type CountOptions = { locale?: string; status: "draft" | "published" }
type TypeCount = { type: string; count: number }

const finish = (counts: TypeCount[]) =>
  counts.filter((c) => c.count > 0).sort((a, b) => b.count - a.count)

/** One `GROUP BY library_type` over the location's link table (Postgres). */
async function countBySql(
  strapi: Core.Strapi,
  relation: Relation,
  documentId: string,
  opts: CountOptions
): Promise<TypeCount[]> {
  const knex = strapi.db.connection
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
    .groupBy("l.library_type")
    .select("l.library_type as type", knex.raw("count(*) as count"))) as {
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
  const counts = await Promise.all(
    LIBRARY_TYPES.map(async (type) => {
      const count = await strapi.documents("api::library.library").count({
        filters: {
          [relation]: { documentId: { $eq: documentId } },
          libraryType: { $eq: type },
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
