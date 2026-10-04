import { errors } from "@strapi/utils"

const LIBRARY = "api::library.library"

/** A library's location relations: field, target type, label. */
const PLACE_RELATIONS = [
  ["continent", "api::continent.continent", "continent"],
  ["country", "api::country.country", "country"],
  ["region", "api::region.region", "region"],
  ["area", "api::area.area", "area"],
] as const

type Place = { documentId: string; name?: string }

type StrapiLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  documents: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contentType: (uid: string) => any
}

const isLocalized = (strapi: StrapiLike, uid: string) =>
  strapi.contentType(uid)?.pluginOptions?.i18n?.localized === true

/**
 * The document a relation value in `data` points at: its documentId, null
 * when the value clears the relation, undefined when it leaves it alone.
 * Covers the shapes Strapi accepts for a to-one relation: a documentId,
 * `{ documentId }`, `{ connect: [...] }`, `{ set: [...] }` and `{ disconnect }`.
 */
export function relationTarget(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value === "string") return value
  if (Array.isArray(value)) return relationTarget(value[0] ?? null)
  if (typeof value !== "object") return undefined
  const v = value as Record<string, unknown>
  if (typeof v.documentId === "string") return v.documentId
  if (Array.isArray(v.set)) return relationTarget(v.set[0] ?? null)
  if (Array.isArray(v.connect) && v.connect.length > 0)
    return relationTarget(v.connect[0])
  if (Array.isArray(v.disconnect) && v.disconnect.length > 0) return null

  return undefined
}

/**
 * The places a library would link to once published that have no published
 * version: its draft's places, overridden by any the call's `data` sets.
 * Strapi 5 leaves such a relation out of the published entry, so publishing
 * would silently drop the library's region: no page path, no listing.
 */
export async function unpublishedPlaces(
  strapi: StrapiLike,
  params: { documentId?: unknown; locale?: unknown; data?: unknown }
): Promise<string[]> {
  const locale =
    typeof params.locale === "string" && params.locale !== "*"
      ? params.locale
      : undefined
  const places: Record<string, Place | null> = {}

  if (typeof params.documentId === "string") {
    const draft = (await strapi.documents(LIBRARY).findOne({
      documentId: params.documentId,
      ...(locale ? { locale } : {}),
      status: "draft",
      fields: ["documentId"],
      populate: Object.fromEntries(
        PLACE_RELATIONS.map(([field]) => [
          field,
          { fields: ["documentId", "name"] },
        ])
      ),
    })) as Record<string, Partial<Place> | null> | null
    for (const [field] of PLACE_RELATIONS) {
      const place = draft?.[field]
      places[field] = place?.documentId
        ? { documentId: place.documentId, name: place.name }
        : null
    }
  }

  const data = (params.data ?? {}) as Record<string, unknown>
  for (const [field] of PLACE_RELATIONS) {
    const target = relationTarget(data[field])
    if (target !== undefined)
      places[field] = target ? { documentId: target } : null
  }

  const missing: string[] = []
  for (const [field, uid, label] of PLACE_RELATIONS) {
    const place = places[field]
    if (!place) continue
    const scope = locale && isLocalized(strapi, uid) ? { locale } : {}
    const published = await strapi.documents(uid).findOne({
      documentId: place.documentId,
      ...scope,
      status: "published",
      fields: ["documentId"],
    })
    if (published) continue
    const name =
      place.name ??
      (
        (await strapi.documents(uid).findOne({
          documentId: place.documentId,
          ...scope,
          status: "draft",
          fields: ["name"],
        })) as { name?: string } | null
      )?.name
    missing.push(`${label} “${name ?? place.documentId}”`)
  }

  return missing
}

/** True for every call that publishes a library, not only `publish`. */
function publishes(action: string, params: Record<string, unknown>): boolean {
  if (action === "publish") return true
  // create and update publish internally when status is "published", without
  // passing a publish action through the middlewares (REST writes do this).

  return (
    (action === "create" || action === "update") &&
    params.status === "published"
  )
}

/** Refuses to publish a library whose continent, country, region or area is unpublished. */
export function registerLibraryPublishPlacesMiddleware({
  strapi,
}: {
  strapi: StrapiLike
}): void {
  strapi.documents.use(
    async (
      context: {
        uid: string
        action: string
        params?: Record<string, unknown>
      },
      next: () => Promise<unknown>
    ) => {
      const params = context.params ?? {}
      if (context.uid !== LIBRARY || !publishes(context.action, params))
        return next()

      const missing = await unpublishedPlaces(strapi, params)
      if (missing.length > 0)
        throw new errors.ValidationError(
          `Publish the ${missing.join(" and the ")} first: a published library can only link to published places.`
        )

      return next()
    }
  )
}
