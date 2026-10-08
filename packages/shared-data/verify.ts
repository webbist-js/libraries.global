// ── Verification ──────────────────────────────────────────────────────────────
// "Still right?": the record sections a reader can confirm without changing
// them, and when each was last checked. One definition for Strapi's apply
// and scoring, the search index's `verified_<section>_ts` and the UI.

export const VERIFY_SECTIONS = [
  "hours",
  "status",
  "address",
  "contact",
] as const
export type VerifySection = (typeof VERIFY_SECTIONS)[number]

/** The library fields each section covers. */
export const SECTION_FIELDS: Record<VerifySection, readonly string[]> = {
  hours: ["openingTimes", "mobileTimetable"],
  status: ["operationalStatus"],
  address: ["streetAddress", "city", "postalCode", "district"],
  contact: ["website", "phone", "email"],
}

/** A stamp is a string `Date.parse` accepts. */
export const isValidStamp = (v: unknown): v is string =>
  typeof v === "string" && !Number.isNaN(Date.parse(v))

/** The fields `sectionCheckedAt` reads. */
export interface VerifiedRecord {
  verifiedSections?: unknown
  lastVerifiedAt?: unknown
}

/**
 * When a section was last confirmed: its own valid stamp in
 * `verifiedSections`. When that map holds no valid stamp at all (rows
 * checked before sections were stamped one by one), `lastVerifiedAt` if it's
 * a valid date. Otherwise null: a section is never dated by another one's
 * stamp.
 */
export function sectionCheckedAt(
  record: VerifiedRecord,
  section: VerifySection
): string | null {
  const map = record.verifiedSections
  const stamps =
    map && typeof map === "object" && !Array.isArray(map)
      ? (map as Record<string, unknown>)
      : {}
  const own = stamps[section]
  if (isValidStamp(own)) return own
  if (Object.values(stamps).some(isValidStamp)) return null
  const last = record.lastVerifiedAt

  return isValidStamp(last) ? last : null
}
