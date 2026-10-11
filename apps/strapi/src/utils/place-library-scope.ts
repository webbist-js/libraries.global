import { DEFAULT_LOCALE } from "@repo/shared-data"
import type { Core } from "@strapi/strapi"

import { isPostgres, libraryJoin, tableOf } from "./library-sql"

type PlaceLibraryRelation = "continent" | "country" | "region"

export const PLACE_LIBRARY_FILTERS = {
  $or: [
    { operationalStatus: { $null: true } },
    { operationalStatus: { $notIn: ["permanently_closed", "planned"] } },
  ],
}

/** Stock follows the canonical search locale; translated metadata does not change totals. */
export function canonicalPlaceLibraries(
  strapi: Core.Strapi,
  _locale: string | undefined,
  status: "draft" | "published",
  place?: { relation: PlaceLibraryRelation; documentId: string }
) {
  const knex = strapi.db.connection
  const selected = knex(`${tableOf(strapi, "api::library.library")} as source`)
    .select(
      "source.*",
      knex.raw(
        "row_number() over (partition by coalesce(nullif(source.entity_ref, ''), source.document_id) order by case when source.locale = ? then 0 else 1 end, source.id) as place_rank",
        [DEFAULT_LOCALE]
      )
    )
    .whereIn("source.locale", [DEFAULT_LOCALE])
  if (place) {
    const join = libraryJoin(strapi, place.relation)
    selected
      .join(`${join.linkTable} as sl`, `sl.${join.libraryColumn}`, "source.id")
      .join(`${join.table} as sp`, "sp.id", `sl.${join.targetColumn}`)
      .where("sp.document_id", place.documentId)
  }
  if (status === "published") selected.whereNotNull("source.published_at")
  else selected.whereNull("source.published_at")

  return knex
    .from(selected.as("l"))
    .where("l.place_rank", 1)
    .where((q) =>
      q
        .whereNull("l.operational_status")
        .orWhereNotIn("l.operational_status", ["permanently_closed", "planned"])
    )
}

export function scopePlaceQuery(
  query: ReturnType<typeof canonicalPlaceLibraries>,
  strapi: Core.Strapi,
  relation: PlaceLibraryRelation,
  documentId: string
) {
  const join = libraryJoin(strapi, relation)

  return query
    .join(`${join.linkTable} as pl`, `pl.${join.libraryColumn}`, "l.id")
    .join(`${join.table} as p`, "p.id", `pl.${join.targetColumn}`)
    .where("p.document_id", documentId)
}

export async function countPlaceLibraries(
  strapi: Core.Strapi,
  relation: PlaceLibraryRelation,
  documentId: string,
  opts: { locale?: string; status: "draft" | "published" }
) {
  if (!isPostgres(strapi))
    return strapi.documents("api::library.library").count({
      filters: {
        [relation]: { documentId: { $eq: documentId } },
        ...PLACE_LIBRARY_FILTERS,
      } as never,
      status: opts.status,
      locale: DEFAULT_LOCALE,
    })
  const [row] = await scopePlaceQuery(
    canonicalPlaceLibraries(strapi, opts.locale, opts.status, {
      relation,
      documentId,
    }),
    strapi,
    relation,
    documentId
  ).countDistinct({ count: "l.id" })

  return Number(row?.count ?? 0)
}
