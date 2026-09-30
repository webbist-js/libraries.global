/**
 * Applies an approved photo (a `correction` with `fields.kind: "photo"`,
 * sent from the hub's "Share a photo"): the file becomes the library's hero
 * image when it has none, otherwise it joins the gallery, and the library
 * is published. Only a file the submitter uploaded through the submission
 * flow is used. The credit and licence are written to the file's caption.
 */

import type { ApplyRecordOutcome } from "./library-record"
import { applyToPublished } from "./publish-guard"

const LIBRARY = "api::library.library"

type Submission = {
  documentId: string
  targetDocumentId?: string | null
  targetSlug?: string | null
  fields?: unknown
}

export function isPhotoCorrection(fields: unknown): boolean {
  return (
    !!fields &&
    typeof fields === "object" &&
    (fields as { kind?: unknown }).kind === "photo"
  )
}

export function photoIdOf(fields: unknown): number | null {
  const id = Number((fields as { photoId?: unknown } | null)?.photoId)

  return Number.isInteger(id) && id > 0 ? id : null
}

/** "Photo: Janet B · CC BY-SA 4.0", from the submission's credit and licence. */
export function photoCaption(fields: unknown): string | null {
  const f = (fields ?? {}) as { credit?: unknown; licence?: unknown }
  const credit =
    typeof f.credit === "string" ? f.credit.trim().slice(0, 120) : ""
  const licence =
    typeof f.licence === "string" ? f.licence.trim().slice(0, 40) : ""
  const parts = [credit ? `Photo: ${credit}` : "", licence].filter(Boolean)

  return parts.length ? parts.join(" · ") : null
}

export async function applyLibraryPhoto(
  strapi: any,
  submission: Submission,
  ownedUploadIds: Set<number>
): Promise<ApplyRecordOutcome> {
  const photoId = photoIdOf(submission.fields)
  if (!photoId || !ownedUploadIds.has(photoId)) {
    strapi.log.warn(
      `[content-moderation] photo ${submission.documentId}: no photo the submitter uploaded; nothing applied`
    )

    return "noop"
  }

  const query = {
    fields: ["documentId", "locale"],
    populate: { heroImage: { fields: ["id"] } },
  }
  const library = submission.targetDocumentId
    ? await strapi
        .documents(LIBRARY)
        .findOne({ documentId: submission.targetDocumentId, ...query })
    : submission.targetSlug
      ? (
          await strapi.documents(LIBRARY).findMany({
            filters: { slug: { $eq: submission.targetSlug } },
            ...query,
            limit: 1,
          })
        )[0]
      : null
  if (!library) {
    strapi.log.warn(
      `[content-moderation] photo ${submission.documentId}: library not found; nothing applied`
    )

    return "noop"
  }

  const caption = photoCaption(submission.fields)
  if (caption) {
    try {
      await strapi
        .plugin("upload")
        .service("upload")
        .updateFileInfo(photoId, { caption })
    } catch (err) {
      strapi.log.warn(
        `[content-moderation] photo ${submission.documentId}: caption not saved (${(err as Error).message})`
      )
    }
  }

  const asHero = !library.heroImage
  const { mode } = await applyToPublished(
    strapi,
    LIBRARY,
    library.documentId,
    {
      ...(asHero
        ? { heroImage: { set: [{ id: photoId }] } }
        : { gallery: { connect: [{ id: photoId }] } }),
      contentUpdatedAt: new Date(),
    },
    { locale: library.locale ?? undefined }
  )
  strapi.log.info(
    `[content-moderation] photo ${submission.documentId}: added to library ${library.documentId} as ${asHero ? "hero image" : "gallery image"}${mode === "draft_only" ? " (draft only)" : ""}`
  )

  return mode === "draft_only" ? "applied_draft" : "applied"
}
