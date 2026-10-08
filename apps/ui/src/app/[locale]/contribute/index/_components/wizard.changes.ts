import { timetableHash } from "@repo/shared-data"

import { SUBMISSION_META_KEYS, type FormData } from "./wizard.types"

const META = new Set<string>(SUBMISSION_META_KEYS)

/** Coordinates travel as a pair: a change to one sends both. */
const PAIRS: Record<string, keyof FormData> = { lat: "lng", lng: "lat" }

function same(a: unknown, b: unknown): boolean {
  if (typeof a === "string" && typeof b === "string")
    return a.trim() === b.trim()

  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

/**
 * The library fields the contributor changed, in form order. Submission
 * metadata (summary, evidence, note) never counts as a change.
 */
export function changedFieldKeys(
  initial: FormData,
  current: FormData
): (keyof FormData)[] {
  const keys = (Object.keys(current) as (keyof FormData)[]).filter(
    (k) => !META.has(k) && !same(initial[k], current[k])
  )
  for (const k of keys) {
    const pair = PAIRS[k]
    if (pair && !keys.includes(pair)) keys.push(pair)
  }

  return keys
}

/**
 * The `fields` of an improve-mode submission: only what changed, plus the
 * values being replaced so a reviewer sees before → after, tagged
 * `kind: "record"` so approval applies it to the library.
 */
export function recordChangesPayload(
  initial: FormData,
  current: FormData
): Record<string, unknown> {
  const changed = changedFieldKeys(initial, current)
  const fields: Record<string, unknown> = { kind: "record" }
  const previous: Record<string, unknown> = {}
  for (const key of changed) {
    fields[key] = current[key]
    previous[key] = initial[key]
  }
  fields.previous = previous
  if (changed.includes("mobileTimetable"))
    fields.previousHash = timetableHash(initial.mobileTimetable)

  return fields
}

/** Each wizard step's fields, for "which step did I change" markers. */
export const STEP_FIELDS: Record<number, readonly (keyof FormData)[]> = {
  1: [
    "name",
    "shortName",
    "libraryType",
    "operatorType",
    "operationalStatus",
    "officialName",
    "summary",
    "closureReason",
    "operatorName",
  ],
  2: [
    "streetAddress",
    "district",
    "city",
    "country",
    "postalCode",
    "lat",
    "lng",
    "continentDocumentId",
    "countryDocumentId",
    "regionDocumentId",
    "areaDocumentId",
    "homeLibrary",
  ],
  3: [
    "website",
    "planVisitUrl",
    "catalogueUrl",
    "membershipUrl",
    "bookingUrl",
    "virtualTourUrl",
    "virtualTourEmbed",
    "donationUrl",
    "admissionInfo",
    "visitNotes",
    "accessibilityNotes",
    "phone",
    "email",
    "transitInfo",
    "languagesServed",
    "openingTimes",
    "mobileTimetable",
    "timetableUrl",
    "services",
    "amenities",
    "accessibility",
    "socialLinks",
  ],
  4: [
    "collectionSize",
    "collectionTypes",
    "specialCollections",
    "classificationSystem",
    "iiifEndpoint",
  ],
  5: [
    "foundedYear",
    "openedYear",
    "closedYear",
    "architect",
    "architecturalStyle",
    "buildingInfo",
  ],
  6: ["uploadedImages", "imageCredit", "imageNote"],
  7: [
    "evidenceType",
    "evidenceUrl",
    "source",
    "sourceUrl",
    "editSummary",
    "note",
  ],
}

/** Steps (1–7) holding at least one changed field. */
export function changedSteps(changed: readonly (keyof FormData)[]): number[] {
  const set = new Set(changed)

  return Object.entries(STEP_FIELDS)
    .filter(([, fields]) => fields.some((f) => set.has(f)))
    .map(([n]) => Number(n))
}

/** Plain text of Strapi blocks (paragraph text, one blank line apart). */
export function blocksToPlainText(blocks: unknown): string {
  if (!Array.isArray(blocks)) return ""

  return blocks
    .map((node) => {
      const children = (node as { children?: unknown })?.children
      if (!Array.isArray(children)) return ""

      return children
        .map((c) => {
          if (typeof (c as { text?: unknown })?.text === "string")
            return (c as { text: string }).text
          const inner = (c as { children?: unknown })?.children

          return Array.isArray(inner)
            ? inner.map((i) => (i as { text?: string })?.text ?? "").join("")
            : ""
        })
        .join("")
    })
    .filter(Boolean)
    .join("\n\n")
}
