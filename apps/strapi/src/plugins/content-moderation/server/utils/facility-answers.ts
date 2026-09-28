import {
  FACILITY_CHECKLIST,
  type FacilityAnswer,
  type FacilityCheck,
  type FacilityCollection,
} from "@repo/shared-data"

/**
 * Approved "Tap Yes or No" answers from the library page (a correction with
 * fields.kind "facilities"). A yes connects the checklist item's CMS entry
 * to the library; a no disconnects it and records the item in the library's
 * `absentFacilities`, so the page can say "No" instead of asking again.
 */

const LIBRARY = "api::library.library"

const COLLECTIONS: Record<
  FacilityCollection,
  { uid: string; relation: "accessibility" | "amenities" | "services" }
> = {
  accessibility: {
    uid: "api::accessibility.accessibility",
    relation: "accessibility",
  },
  amenity: { uid: "api::amenity.amenity", relation: "amenities" },
  service: { uid: "api::service.service", relation: "services" },
}

export type ParsedAnswer = { check: FacilityCheck; answer: FacilityAnswer }

/**
 * The valid answers in a submission's fields: checklist questions only,
 * answered "yes" or "no". Anything else a client sent is dropped.
 */
export function parseFacilityAnswers(fields: unknown): ParsedAnswer[] {
  if (!fields || typeof fields !== "object") return []
  const f = fields as { kind?: unknown; answers?: unknown }
  if (f.kind !== "facilities" || !f.answers || typeof f.answers !== "object")
    return []
  const answers = f.answers as Record<string, unknown>

  return FACILITY_CHECKLIST.flatMap((check) => {
    const answer = answers[check.label]

    return answer === "yes" || answer === "no" ? [{ check, answer }] : []
  })
}

/** The library's absent list after these answers, in checklist order. */
export function nextAbsentFacilities(
  current: unknown,
  answers: readonly ParsedAnswer[]
): string[] {
  const absent = new Set(
    Array.isArray(current)
      ? current.filter((x): x is string => typeof x === "string")
      : []
  )
  for (const { check, answer } of answers) {
    if (answer === "no") absent.add(check.label)
    else absent.delete(check.label)
  }
  const order = FACILITY_CHECKLIST.map((c) => c.label)

  return [...absent].sort((a, b) => order.indexOf(a) - order.indexOf(b))
}

type Submission = {
  documentId: string
  targetDocumentId?: string | null
  targetSlug?: string | null
  fields?: unknown
}

/** The reviewed target: targetDocumentId when set, else the slug. */
async function findLibrary(strapi: any, submission: Submission) {
  const fields = ["documentId", "locale", "absentFacilities"]
  if (submission.targetDocumentId)
    return strapi.documents(LIBRARY).findOne({
      documentId: submission.targetDocumentId,
      status: "published",
      fields,
    })
  if (!submission.targetSlug) return null
  const [library] = await strapi.documents(LIBRARY).findMany({
    filters: { slug: { $eq: submission.targetSlug } },
    status: "published",
    fields,
    limit: 1,
  })

  return library ?? null
}

/**
 * Applies an approved facilities correction to the library and publishes
 * it. "noop" when the submission holds no valid answers or its library is
 * gone. Database errors propagate so the approval is reverted.
 */
export async function applyFacilityAnswers(
  strapi: any,
  submission: Submission
): Promise<"applied" | "noop"> {
  const answers = parseFacilityAnswers(submission.fields)
  if (answers.length === 0) return "noop"

  const library = await findLibrary(strapi, submission)
  if (!library) {
    strapi.log.warn(
      `[content-moderation] facilities ${submission.documentId}: library not found; nothing applied`
    )

    return "noop"
  }

  const data: Record<string, unknown> = {
    absentFacilities: nextAbsentFacilities(library.absentFacilities, answers),
  }

  for (const [collection, { uid, relation }] of Object.entries(COLLECTIONS)) {
    const mine = answers.filter((a) => a.check.collection === collection)
    if (mine.length === 0) continue
    const entries = (await strapi.documents(uid).findMany({
      filters: { name: { $in: mine.map((a) => a.check.name) } },
      status: "published",
      fields: ["documentId", "name"],
    })) as { documentId: string; name: string }[]
    const idFor = new Map(entries.map((e) => [e.name, e.documentId]))

    const connect: { documentId: string }[] = []
    const disconnect: { documentId: string }[] = []
    for (const { check, answer } of mine) {
      const documentId = idFor.get(check.name)
      if (!documentId) {
        strapi.log.warn(
          `[content-moderation] facilities ${submission.documentId}: no published ${collection} named "${check.name}"; skipped "${check.label}"`
        )
        continue
      }
      ;(answer === "yes" ? connect : disconnect).push({ documentId })
    }
    data[relation] = { connect, disconnect }
  }

  await strapi.documents(LIBRARY).update({
    documentId: library.documentId,
    locale: library.locale ?? "en",
    status: "published",
    data,
  })

  return "applied"
}
