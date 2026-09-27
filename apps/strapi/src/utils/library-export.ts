import { resolveEntitlements } from "@repo/access"
import type { Core } from "@strapi/strapi"

const LIBRARY = "api::library.library"

/**
 * Most ids one export may ask for: the largest plan's row cap (Team), read
 * from the resolver so it can't drift. The Next route applies each plan's cap.
 */
export const LIBRARY_EXPORT_MAX_IDS = resolveEntitlements({
  signedIn: true,
  now: new Date(0),
  grants: [{ plan: "team", expiresAt: null }],
}).limits.exportRows

/** documentIds per findMany: one `$in` of at most this many. */
export const LIBRARY_EXPORT_BATCH = 500

// The documentId shape content-moderation's isDocumentId accepts. The plugin
// is compiled separately, so its helper isn't imported here.
const DOCUMENT_ID = /^[a-z0-9]{20,32}$/

/**
 * One library's export fields: the Atlas export's columns except `url`,
 * which the Next route builds from the three location slugs.
 */
export type LibraryExportRow = {
  name: string | null
  slug: string | null
  libraryType: string | null
  operationalStatus: string | null
  streetAddress: string | null
  city: string | null
  region: string | null
  country: string | null
  lat: number | null
  lng: number | null
  website: string | null
  phone: string | null
  email: string | null
  continentSlug: string | null
  countrySlug: string | null
  regionSlug: string | null
}

type ExportSource = {
  documentId: string
  name?: string | null
  slug?: string | null
  libraryType?: string | null
  operationalStatus?: string | null
  streetAddress?: string | null
  city?: string | null
  location?: unknown
  website?: string | null
  phone?: string | null
  email?: string | null
  continent?: { slug?: string | null } | null
  country?: { slug?: string | null; name?: string | null } | null
  region?: { slug?: string | null; name?: string | null } | null
}

/** The body's ids, or null unless it's `{ ids }` with 1 to the max documentIds. */
export function parseExportIds(body: unknown): string[] | null {
  const ids = (body as { ids?: unknown } | null | undefined)?.ids
  if (!Array.isArray(ids) || ids.length === 0) return null
  if (ids.length > LIBRARY_EXPORT_MAX_IDS) return null

  return ids.every((v) => typeof v === "string" && DOCUMENT_ID.test(v))
    ? (ids as string[])
    : null
}

const coordinate = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null

function toRow(lib: ExportSource): LibraryExportRow {
  const loc = lib.location as { lat?: unknown; lng?: unknown } | null

  return {
    name: lib.name ?? null,
    slug: lib.slug ?? null,
    libraryType: lib.libraryType ?? null,
    operationalStatus: lib.operationalStatus ?? null,
    streetAddress: lib.streetAddress ?? null,
    city: lib.city ?? null,
    region: lib.region?.name ?? null,
    country: lib.country?.name ?? null,
    lat: coordinate(loc?.lat),
    lng: coordinate(loc?.lng),
    website: lib.website ?? null,
    phone: lib.phone ?? null,
    email: lib.email ?? null,
    continentSlug: lib.continent?.slug ?? null,
    countrySlug: lib.country?.slug ?? null,
    regionSlug: lib.region?.slug ?? null,
  }
}

/**
 * Published libraries for the given documentIds, keyed by documentId, read in
 * batches. Ids that aren't found (or aren't published) are simply absent.
 */
export async function findLibrariesForExport(
  strapi: Core.Strapi,
  ids: readonly string[]
): Promise<Record<string, LibraryExportRow>> {
  const unique = [...new Set(ids)]
  const docs = strapi.documents(LIBRARY)
  const rows: Record<string, LibraryExportRow> = {}
  for (let i = 0; i < unique.length; i += LIBRARY_EXPORT_BATCH) {
    const batch = unique.slice(i, i + LIBRARY_EXPORT_BATCH)
    const found = (await docs.findMany({
      filters: { documentId: { $in: batch } },
      fields: [
        "name",
        "slug",
        "libraryType",
        "operationalStatus",
        "streetAddress",
        "city",
        "location",
        "website",
        "phone",
        "email",
      ],
      populate: {
        continent: { fields: ["slug"] },
        country: { fields: ["slug", "name"] },
        region: { fields: ["slug", "name"] },
      },
      status: "published",
      limit: batch.length,
    } as never)) as unknown as ExportSource[]
    for (const lib of found) rows[lib.documentId] = toRow(lib)
  }

  return rows
}
