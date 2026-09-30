import type { Core } from "@strapi/strapi"

import { invalidateAtlasCache } from "../utils/atlas-cache"
import {
  COMPLETENESS_TRIGGER_KEYS,
  refreshLibraryCompleteness,
} from "../utils/library-completeness"

type TrackedUID =
  | "api::country.country"
  | "api::region.region"
  | "api::area.area"
  | "api::library.library"

const TRACKED_UIDS: TrackedUID[] = [
  "api::country.country",
  "api::region.region",
  "api::area.area",
  "api::library.library",
]

const LIBRARY = "api::library.library"
const REGION = "api::region.region"

/** Writes to these keys can change an entityRef. */
const REF_TRIGGER_KEYS = ["slug", "continent", "country", "region", "area"]

/**
 * Keys this subscriber writes itself (plus what Strapi adds to any write).
 * A write touching nothing else is one of ours and must not start another
 * recompute, or the entityRef and completeness updates would loop.
 */
const SELF_WRITE_KEYS = new Set([
  "entityRef",
  "completeness",
  "id",
  "documentId",
  "locale",
  "updatedAt",
  "updatedBy",
  "createdBy",
  "publishedAt",
])

const touches = (data: Record<string, unknown>, keys: readonly string[]) =>
  keys.some((k) => k in data)

const isSelfWrite = (data: Record<string, unknown>) =>
  Object.keys(data).every((k) => SELF_WRITE_KEYS.has(k))

type Row = {
  id?: number
  documentId?: string
  entityRef?: string
  slug?: string
  locale?: string | null
  publishedAt?: string | null
  completeness?: number | null
}

async function computeEntityRef(
  strapi: Core.Strapi,
  uid: TrackedUID,
  documentId: string
): Promise<string | null> {
  try {
    if (uid === "api::country.country") {
      const e = await strapi.documents(uid).findOne({
        documentId,
        fields: ["slug"],
        populate: { continent: { fields: ["slug"] } } as never,
      })
      if (
        e?.slug &&
        (e as unknown as { continent?: { slug?: string } }).continent?.slug
      ) {
        return `${(e as unknown as { continent: { slug: string } }).continent.slug}:${e.slug}`
      }
    }

    if (uid === "api::region.region") {
      const e = await strapi.documents(uid).findOne({
        documentId,
        fields: ["slug"],
        populate: {
          continent: { fields: ["slug"] },
          country: { fields: ["slug"] },
        } as never,
      })
      const ec = e as {
        slug?: string
        continent?: { slug?: string }
        country?: { slug?: string }
      } | null
      if (ec?.slug && ec.continent?.slug && ec.country?.slug) {
        return `${ec.continent.slug}:${ec.country.slug}:${ec.slug}`
      }
    }

    if (uid === "api::area.area") {
      const e = await strapi.documents(uid).findOne({
        documentId,
        fields: ["slug"],
        populate: {
          country: { fields: ["slug"] },
          region: {
            fields: ["slug"],
            populate: { continent: { fields: ["slug"] } },
          },
        } as never,
      })
      const ea = e as {
        slug?: string
        country?: { slug?: string }
        region?: { slug?: string; continent?: { slug?: string } }
      } | null
      if (
        ea?.slug &&
        ea.country?.slug &&
        ea.region?.slug &&
        ea.region.continent?.slug
      ) {
        return `${ea.region.continent.slug}:${ea.country.slug}:${ea.region.slug}:${ea.slug}`
      }
    }
    if (uid === "api::library.library") {
      const e = await strapi.documents(uid).findOne({
        documentId,
        fields: ["slug"],
        populate: {
          continent: { fields: ["slug"] },
          country: { fields: ["slug"] },
          region: { fields: ["slug"] },
          area: { fields: ["slug"] },
        } as never,
      })
      const el = e as {
        slug?: string
        continent?: { slug?: string }
        country?: { slug?: string }
        region?: { slug?: string }
        area?: { slug?: string } | null
      } | null

      if (
        el?.slug &&
        el.continent?.slug &&
        el.country?.slug &&
        el.region?.slug
      ) {
        const parts = [el.continent.slug, el.country.slug, el.region.slug]
        if (el.area?.slug) parts.push(el.area.slug)
        parts.push(el.slug)

        return parts.join(":")
      }
    }
  } catch {
    // non-critical — entityRef will remain unchanged
  }

  return null
}

async function maybeUpdateEntityRef(
  strapi: Core.Strapi,
  uid: TrackedUID,
  result: Row | null
) {
  const documentId = result?.documentId
  if (!documentId) return

  const computed = await computeEntityRef(strapi, uid, documentId)
  if (!computed || computed === result?.entityRef) return

  try {
    await strapi.documents(uid).update({
      documentId,
      data: { entityRef: computed } as never,
    })
  } catch {
    // uniqueness collision or other non-critical error
  }
}

const REGION_LIBRARY_PAGE = 200

/**
 * A region's slug is part of every one of its libraries' refs. Walk them in
 * pages and let `maybeUpdateEntityRef` rewrite only the ones that changed.
 */
async function refreshRegionLibraryRefs(
  strapi: Core.Strapi,
  regionDocumentId: string
) {
  for (let start = 0; ; start += REGION_LIBRARY_PAGE) {
    const rows = (await strapi.documents(LIBRARY).findMany({
      filters: { region: { documentId: { $eq: regionDocumentId } } } as never,
      fields: ["documentId", "entityRef"] as never,
      sort: "id:asc" as never,
      start,
      limit: REGION_LIBRARY_PAGE,
    })) as unknown as Row[]
    for (const row of rows) await maybeUpdateEntityRef(strapi, LIBRARY, row)
    if (rows.length < REGION_LIBRARY_PAGE) break
  }
}

async function maybeUpdateCompleteness(strapi: Core.Strapi, result: Row) {
  if (typeof result.id !== "number" || !result.documentId) return
  await refreshLibraryCompleteness(strapi, {
    id: result.id,
    documentId: result.documentId,
    locale: result.locale,
    publishedAt: result.publishedAt,
    completeness: result.completeness,
  })
}

export const registerEntityRefSubscriber = ({
  strapi,
}: {
  strapi: Core.Strapi
}) => {
  strapi.db.lifecycles.subscribe({
    models: TRACKED_UIDS as unknown as string[],

    async beforeUpdate(event) {
      // Remember the region's slug so afterUpdate can tell a real change
      // from a save that merely re-sends it.
      const data = (event.params?.data ?? {}) as Record<string, unknown>
      if (event.model.uid !== REGION || !("slug" in data)) return
      try {
        const previous = (await strapi.db
          .query(REGION)
          .findOne({ where: event.params.where, select: ["slug"] })) as {
          slug?: string
        } | null
        ;(event.state as Record<string, unknown>).previousSlug =
          previous?.slug ?? null
      } catch {
        // non-critical: without it the refs are refreshed on the next save
      }
    },

    async afterCreate(event) {
      const uid = event.model.uid as TrackedUID
      const result = event.result as Row
      if (uid === LIBRARY) invalidateAtlasCache()
      await maybeUpdateEntityRef(strapi, uid, result)
      if (uid === LIBRARY) await maybeUpdateCompleteness(strapi, result)
    },

    async afterUpdate(event) {
      const uid = event.model.uid as TrackedUID
      const result = event.result as Row
      const data = (event.params?.data ?? {}) as Record<string, unknown>
      if (uid === LIBRARY) invalidateAtlasCache()
      if (isSelfWrite(data)) return

      if (touches(data, REF_TRIGGER_KEYS)) {
        await maybeUpdateEntityRef(strapi, uid, result)
      }
      if (uid === LIBRARY && touches(data, COMPLETENESS_TRIGGER_KEYS)) {
        await maybeUpdateCompleteness(strapi, result)
      }
      if (uid === REGION && result?.documentId) {
        const previous = (event.state as { previousSlug?: string | null })
          .previousSlug
        if (
          previous !== undefined &&
          previous !== null &&
          previous !== result.slug
        ) {
          await refreshRegionLibraryRefs(strapi, result.documentId)
        }
      }
    },

    afterDelete(event) {
      if (event.model.uid === LIBRARY) invalidateAtlasCache()
    },
  })
}
