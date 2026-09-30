import type { Core } from "@strapi/strapi"

const PG_CLIENTS = new Set(["pg", "postgres", "postgresql"])

/** True when the app database is Postgres (the only dialect the raw aggregates target). */
export function isPostgres(strapi: Core.Strapi): boolean {
  const client = (strapi.db as { dialect?: { client?: unknown } } | undefined)
    ?.dialect?.client

  return PG_CLIENTS.has(String(client ?? "").toLowerCase())
}

type Metadata = {
  tableName: string
  attributes: Record<
    string,
    {
      joinTable?: {
        name: string
        joinColumn: { name: string }
        inverseJoinColumn: { name: string }
      }
    }
  >
}

const metadataOf = (strapi: Core.Strapi, uid: string): Metadata =>
  (strapi.db.metadata as { get: (uid: string) => Metadata }).get(uid)

/** The SQL table behind a content type. */
export function tableOf(strapi: Core.Strapi, uid: string): string {
  return metadataOf(strapi, uid).tableName
}

export type LibraryJoin = {
  /** e.g. `libraries_country_lnk` */
  linkTable: string
  /** the link column pointing at `libraries.id`, e.g. `library_id` */
  libraryColumn: string
  /** the link column pointing at the target, e.g. `country_id` */
  targetColumn: string
  /** the target table, e.g. `countries` */
  table: string
}

/**
 * The link table Strapi keeps for a library's location relation
 * (`libraries_<rel>_lnk (library_id, <rel>_id)`), read from the database
 * metadata rather than assumed.
 */
export function libraryJoin(
  strapi: Core.Strapi,
  relation: "continent" | "country" | "region" | "area"
): LibraryJoin {
  const attribute = metadataOf(strapi, "api::library.library").attributes[
    relation
  ]
  const joinTable = attribute?.joinTable
  if (!joinTable) {
    throw new Error(`library.${relation} has no join table in the metadata`)
  }

  return {
    linkTable: joinTable.name,
    libraryColumn: joinTable.joinColumn.name,
    targetColumn: joinTable.inverseJoinColumn.name,
    table: tableOf(strapi, `api::${relation}.${relation}`),
  }
}
