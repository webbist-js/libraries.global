import {
  isValidStamp,
  SECTION_FIELDS,
  VERIFY_SECTIONS,
  type VerifySection,
} from "@repo/shared-data"

import type { ApplyRecordOutcome } from "./library-record"
import { defaultLocale } from "./locales"
import { applyToPublished } from "./publish-guard"

/**
 * "Still right?": a `correction` with `fields.kind: "verify"` confirms some
 * of a library's sections without changing them. Approval stamps each one in
 * `verifiedSections`, and `lastVerifiedAt` becomes the latest stamp. An
 * approved edit stamps the sections it sets (applyLibraryRecord). Sections
 * are shared by every locale version, so stamps are too.
 */

const LIBRARY = "api::library.library"

// The sections and their fields are shared with the index and the UI.
export { SECTION_FIELDS, VERIFY_SECTIONS, type VerifySection }

export function isVerification(fields: unknown): boolean {
  return (
    !!fields &&
    typeof fields === "object" &&
    (fields as { kind?: unknown }).kind === "verify"
  )
}

/** The confirmed sections: valid ones only, once each, in VERIFY_SECTIONS order. */
export function verifySections(fields: unknown): VerifySection[] {
  const raw = (fields as { sections?: unknown } | null)?.sections
  const asked = new Set(Array.isArray(raw) ? raw : [])

  return VERIFY_SECTIONS.filter((s) => asked.has(s))
}

/**
 * The sections a record update sets: a non-null value for one of its fields.
 * Setting the status to "unknown" checks nothing.
 */
export function sectionsSetBy(data: Record<string, unknown>): VerifySection[] {
  return VERIFY_SECTIONS.filter((s) =>
    SECTION_FIELDS[s].some((f) => {
      const v = data[f]

      return (
        v !== undefined &&
        v !== null &&
        !(f === "operationalStatus" && v === "unknown")
      )
    })
  )
}

export function stampSections(
  current: unknown,
  sections: readonly VerifySection[],
  at: Date
): Record<VerifySection, string> {
  const map: Partial<Record<VerifySection, string>> = {}
  if (current && typeof current === "object" && !Array.isArray(current))
    for (const s of VERIFY_SECTIONS) {
      const v = (current as Record<string, unknown>)[s]
      // ISO, so `latestStamp`'s string sort orders them by time.
      if (isValidStamp(v)) map[s] = new Date(v).toISOString()
    }
  for (const s of sections) map[s] = at.toISOString()

  return map as Record<VerifySection, string>
}

export function latestStamp(map: Record<string, string>): string | null {
  const stamps = Object.values(map).filter((v) => typeof v === "string")

  return stamps.length > 0 ? stamps.sort()[stamps.length - 1]! : null
}

type Submission = {
  documentId: string
  targetDocumentId?: string | null
  targetSlug?: string | null
  fields?: unknown
}

async function findLibrary(
  strapi: any,
  submission: Submission,
  base: string,
  fields: string[]
) {
  if (submission.targetDocumentId)
    return strapi.documents(LIBRARY).findOne({
      documentId: submission.targetDocumentId,
      locale: base,
      fields: ["documentId", ...fields],
    })
  if (!submission.targetSlug) return null
  const [library] = await strapi.documents(LIBRARY).findMany({
    filters: { slug: { $eq: submission.targetSlug } },
    locale: base,
    fields: ["documentId", ...fields],
    limit: 1,
  })

  return library ?? null
}

/**
 * Stamps an approved verification's sections on the library and publishes
 * it. "noop" when it confirms no valid section or its library is gone.
 * Database errors propagate so the approval is reverted, and so does
 * `ApplyRefusedError` when the library has no published version.
 */
export async function applyVerification(
  strapi: any,
  submission: Submission
): Promise<ApplyRecordOutcome> {
  const sections = verifySections(submission.fields)
  if (sections.length === 0) return "noop"
  const base = await defaultLocale(strapi)
  const library = await findLibrary(strapi, submission, base, [
    "verifiedSections",
  ])
  if (!library) {
    strapi.log?.warn?.(
      `[content-moderation] verify ${submission.documentId}: library not found; nothing applied`
    )

    return "noop"
  }
  const verifiedSections = stampSections(
    library.verifiedSections,
    sections,
    new Date()
  )
  const { mode } = await applyToPublished(
    strapi,
    LIBRARY,
    library.documentId,
    { verifiedSections, lastVerifiedAt: latestStamp(verifiedSections) },
    { locale: base }
  )

  return mode === "draft_only" ? "applied_draft" : "applied"
}

const STAMP_FIELDS = new Set(["verifiedSections", "lastVerifiedAt"])

/**
 * The live values a Moderator checks a verification against, with the
 * section stamps and `lastVerifiedAt`, so the review dates each section by
 * the shared `sectionCheckedAt` rule, as the library page does.
 */
export async function verifyReview(strapi: any, submission: Submission) {
  if (!isVerification(submission.fields)) return null
  const sections = verifySections(submission.fields)
  const base = await defaultLocale(strapi)
  const fields = [
    ...new Set(sections.flatMap((s) => SECTION_FIELDS[s])),
    ...STAMP_FIELDS,
  ]
  const library = await findLibrary(strapi, submission, base, fields)
  if (!library) return null
  const current: Record<string, unknown> = {}
  for (const f of fields)
    if (!STAMP_FIELDS.has(f) && f in library) current[f] = library[f]
  const last = library.lastVerifiedAt

  return {
    sections,
    current,
    verifiedSections: stampSections(library.verifiedSections, [], new Date()),
    lastVerifiedAt:
      last instanceof Date
        ? last.toISOString()
        : isValidStamp(last)
          ? last
          : null,
  }
}
