import type { NetworkKind } from "@repo/shared-data"

import type { DocumentRuntime, DocumentStore, Identity } from "./document-store"

type Membership = Identity & {
  name: string
  slug: string
  kind: NetworkKind
  publicPageEnabled: boolean
  publicPageReviewedAt: string | null
}

/** Public relation sanitization depends on generic Network read permissions.
 * Supply only this reviewed projection, from the published canonical record. */
export async function publicLibraryNetworks(
  strapi: DocumentRuntime,
  documentId: string
) {
  const library = await (
    strapi.documents("api::library.library") as DocumentStore<
      Identity & { networks?: Membership[] }
    >
  ).findOne({
    documentId,
    locale: "en",
    status: "published",
    fields: ["documentId"],
    populate: {
      networks: {
        filters: {
          publicPageEnabled: true,
          publicPageReviewedAt: { $notNull: true },
        },
        fields: [
          "name",
          "slug",
          "kind",
          "publicPageEnabled",
          "publicPageReviewedAt",
        ],
      },
    },
  })

  return (library?.networks ?? [])
    .filter((row) => row.publicPageEnabled && row.publicPageReviewedAt)
    .map((row) => ({
      documentId: row.documentId,
      name: row.name,
      slug: row.slug,
      kind: row.kind,
      publicPageEnabled: true,
      publicPageReviewedAt: row.publicPageReviewedAt,
    }))
}
