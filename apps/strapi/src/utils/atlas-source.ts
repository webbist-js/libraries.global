import {
  ATLAS_LIMITS,
  type AtlasLibrarySource,
  type AtlasPlace,
  type AtlasOption,
} from "@repo/shared-data"

const LIBRARY = "api::library.library"
const NOTICE = "api::library-notice.library-notice"

export const ATLAS_SOURCE_FIELDS = [
  "documentId",
  "locale",
  "publishedAt",
  "name",
  "slug",
  "libraryType",
  "operationalStatus",
  "operatorType",
  "city",
  "location",
  "timezone",
  "openingTimes",
  "foundedYear",
  "openedYear",
  "completeness",
  "hasActiveFeed",
  "catalogueUrl",
  "mobileTimetable",
]
const POPULATE = {
  ...Object.fromEntries(
    ["continent", "country", "region", "area"].map((field) => [
      field,
      { fields: ["documentId", "name", "slug"] },
    ])
  ),
  ...Object.fromEntries(
    ["accessibility", "services", "amenities"].map((field) => [
      field,
      { fields: ["documentId", "name"] },
    ])
  ),
}
const place = (row: any): AtlasPlace | null =>
  row ? { documentId: row.documentId, name: row.name, slug: row.slug } : null
const options = (
  rows: any[] | undefined,
  aliases?: Map<string, string[]>
): AtlasOption[] =>
  (rows ?? []).map((row) => ({
    documentId: row.documentId,
    name: row.name,
    aliases: aliases?.get(row.documentId) ?? [],
  }))

/** An explicit DTO: CMS media, accounts, credentials and timetable contents never leave here. */
export function atlasSourceDto(
  row: any,
  notices: any[] = [],
  aliases: Record<string, Map<string, string[]>> = {}
): AtlasLibrarySource {
  return {
    ...Object.fromEntries(
      ATLAS_SOURCE_FIELDS.filter(
        (field) => !["publishedAt", "mobileTimetable"].includes(field)
      ).map((field) => [field, row[field]])
    ),
    documentId: row.documentId,
    locale: row.locale ?? "en",
    published: Boolean(row.publishedAt),
    name: row.name,
    slug: row.slug,
    mobileTimetable:
      row.mobileTimetable === null || row.mobileTimetable === undefined
        ? null
        : { present: true },
    continent: place(row.continent),
    country: place(row.country),
    region: place(row.region),
    area: place(row.area),
    accessibility: options(row.accessibility, aliases.accessibility),
    services: options(row.services, aliases.services),
    amenities: options(row.amenities, aliases.amenities),
    notices: notices.map((n) => ({
      id: n.documentId,
      documentId: n.documentId,
      type: n.type,
      scope: n.scope,
      scopeWeek: n.scopeWeek ?? null,
      scopeDay: n.scopeDay ?? null,
      stopId: null,
      from: n.from,
      to: n.to ?? null,
      endedAt: n.endedAt ?? null,
      hours: n.hours,
      message: "",
      reason: null,
    })),
  }
}

export async function atlasSourceRows(
  strapi: any,
  filters: object,
  limit: number,
  locale: string
): Promise<{ id: number; source: AtlasLibrarySource }[]> {
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > ATLAS_LIMITS.backfillBatch
  )
    throw new RangeError("Invalid source batch")
  const rows = await strapi.documents(LIBRARY).findMany({
    status: "published",
    locale,
    filters,
    fields: ATLAS_SOURCE_FIELDS,
    populate: POPULATE,
    sort: "id:asc",
    limit,
  })
  if (rows.length === 0) return []
  const ids = rows.map((row: any) => row.documentId)
  const aliases: Record<string, Map<string, string[]>> = {}
  for (const [field, uid] of [
    ["accessibility", "api::accessibility.accessibility"],
    ["services", "api::service.service"],
    ["amenities", "api::amenity.amenity"],
  ]) {
    const optionIds = [
      ...new Set(
        rows.flatMap((row: any) =>
          (row[field] ?? []).map((option: any) => option.documentId)
        )
      ),
    ]
    aliases[field!] = new Map()
    if (!optionIds.length) continue
    if (optionIds.length > 512)
      throw new RangeError(
        "Facility source batch overflow; reduce the library batch"
      )
    const translations = await strapi.documents(uid).findMany({
      status: "published",
      locale: "*",
      filters: { documentId: { $in: optionIds } },
      fields: ["documentId", "name"],
      sort: "id:asc",
      limit: 2001,
    })
    if (translations.length > 2000)
      throw new RangeError(
        "Facility translations overflow; reduce the library batch"
      )
    for (const option of translations)
      aliases[field!]!.set(option.documentId, [
        ...new Set([
          ...(aliases[field!]!.get(option.documentId) ?? []),
          option.name,
        ]),
      ])
  }

  // Ended/historical notices do not affect hours. Future notices are retained so
  // the external clock can schedule their start without any midnight CMS loop.
  const yesterday = new Date(Date.now() - 8 * 86400000)
    .toISOString()
    .slice(0, 10)
  const recentStart = new Date(Date.now() - 38 * 86400000)
    .toISOString()
    .slice(0, 10)
  const notices = await strapi.documents(NOTICE).findMany({
    filters: {
      library: { documentId: { $in: ids } },
      type: { $in: ["closure", "changed_hours"] },
      endedAt: { $null: true },
      $or: [
        { to: { $gte: yesterday } },
        { to: { $null: true }, from: { $gte: recentStart } },
      ],
    },
    fields: [
      "documentId",
      "type",
      "scope",
      "scopeWeek",
      "scopeDay",
      "from",
      "to",
      "endedAt",
      "hours",
    ],
    populate: { library: { fields: ["documentId"] } },
    sort: "id:asc",
    limit: ATLAS_LIMITS.sourceBatch + 1,
  })
  if (notices.length > ATLAS_LIMITS.sourceBatch)
    throw new RangeError(
      "Notice source batch overflow; reduce the library batch"
    )
  const grouped = new Map<string, any[]>()
  for (const notice of notices) {
    const id = notice.library?.documentId
    if (!id) continue
    const group = grouped.get(id) ?? []
    group.push(notice)
    grouped.set(id, group)
  }
  const result = rows.map((row: any) => ({
    id: row.id,
    source: atlasSourceDto(row, grouped.get(row.documentId), aliases),
  }))
  if (Buffer.byteLength(JSON.stringify(result)) > 7 * 1024 * 1024)
    throw new RangeError(
      "Atlas source bytes overflow; reduce the library batch"
    )

  return result
}
