import type { Core } from "@strapi/strapi"

type TrackedUID =
  | "api::country.country"
  | "api::region.region"
  | "api::area.area"

const TRACKED_UIDS: TrackedUID[] = [
  "api::country.country",
  "api::region.region",
  "api::area.area",
]

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
  } catch {
    // non-critical — entityRef will remain unchanged
  }

  return null
}

async function maybeUpdateEntityRef(
  strapi: Core.Strapi,
  uid: TrackedUID,
  result: { documentId?: string; entityRef?: string } | null
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

export const registerEntityRefSubscriber = ({
  strapi,
}: {
  strapi: Core.Strapi
}) => {
  strapi.db.lifecycles.subscribe({
    models: TRACKED_UIDS as unknown as string[],

    async afterCreate(event) {
      const uid = event.model.uid as TrackedUID
      await maybeUpdateEntityRef(
        strapi,
        uid,
        event.result as { documentId?: string; entityRef?: string }
      )
    },

    async afterUpdate(event) {
      const uid = event.model.uid as TrackedUID
      await maybeUpdateEntityRef(
        strapi,
        uid,
        event.result as { documentId?: string; entityRef?: string }
      )
    },
  })
}
