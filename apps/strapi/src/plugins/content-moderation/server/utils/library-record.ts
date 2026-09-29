import { isDocumentId } from "./params"

/**
 * Applies an approved record edit to a library and publishes it (C-L1).
 *
 * Two submission types carry one: a claimant's `library_edit`, and a
 * `correction` with `fields.kind: "record"` from anyone else who improved
 * the record in the Index editor. Both send only the fields they changed,
 * so an empty string means "clear this", and an absent key means "leave
 * it". Everything is checked against an allowlist first: unknown keys,
 * unknown enum values and malformed relations are dropped, never written.
 */

const LIBRARY = "api::library.library"

const STRING_FIELDS = new Set([
  "name",
  "shortName",
  "summary",
  "streetAddress",
  "city",
  "district",
  "postalCode",
  "website",
  "catalogueUrl",
  "membershipUrl",
  "bookingUrl",
  "planVisitUrl",
  "virtualTourUrl",
  "donationUrl",
  "virtualTourEmbed",
  "email",
  "phone",
  "admissionInfo",
  "closureReason",
  "architect",
  "buildingInfo",
  "languagesServed",
  "classificationSystem",
  "iiifEndpoint",
  "transitInfo",
  "nearestStation",
  "wikidataId",
  "foundedYear",
  "openedYear",
  "closedYear",
  "source",
  "sourceUrl",
])

/** Fields that can't be cleared: the schema requires them or they're enums. */
const NEVER_CLEAR = new Set(["name"])

const ENUM_FIELDS: Record<string, readonly string[]> = {
  libraryType: [
    "National",
    "Public",
    "Academic",
    "University",
    "Parliamentary",
    "State",
    "Municipal",
    "Special",
    "Monastic",
    "Archive",
    "Private",
    "Cultural",
    "Digital",
    "Mobile",
    "Other",
  ],
  operatorType: [
    "National Government",
    "Regional Government",
    "Municipality",
    "University",
    "Religious Institution",
    "Private Foundation",
    "Independent",
    "Volunteer Managed",
    "Community Managed",
    "Other",
  ],
  operationalStatus: [
    "open",
    "temporarily_closed",
    "permanently_closed",
    "seasonal",
    "appointment_only",
    "planned",
    "unknown",
  ],
}

/** Plain text in the form, Strapi blocks on the record. */
const BLOCKS_FIELDS = new Set(["accessibilityNotes", "visitNotes"])

const RELATION_SETS = new Set(["services", "amenities", "accessibility"])

const HIERARCHY: Record<string, string> = {
  continentDocumentId: "continent",
  countryDocumentId: "country",
  regionDocumentId: "region",
  areaDocumentId: "area",
}

const SOCIAL_PLATFORMS = new Set([
  "facebook",
  "instagram",
  "x",
  "linkedin",
  "youtube",
  "tiktok",
  "whatsapp",
  "telegram",
  "wechat",
  "threads",
  "bluesky",
  "mastodon",
  "pinterest",
])

const MAX_STRING = 5000

function toBlocks(text: string) {
  return [
    {
      type: "paragraph",
      children: [{ type: "text", text }],
    },
  ]
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? ""))

  return Number.isFinite(n) ? n : null
}

/** True for a `correction` that carries record fields (vs. facilities or free text). */
export function isRecordCorrection(fields: unknown): boolean {
  return (
    !!fields &&
    typeof fields === "object" &&
    (fields as { kind?: unknown }).kind === "record"
  )
}

export type LibraryRecordData = Record<string, unknown>

/**
 * The Strapi update payload for these submitted fields. Only allowlisted
 * keys survive; the result is empty when nothing valid was sent.
 */
export function buildLibraryRecordData(
  fields: unknown,
  opts: { ownedUploadIds?: Set<number> } = {}
): LibraryRecordData {
  const data: LibraryRecordData = {}
  if (!fields || typeof fields !== "object") return data
  const f = fields as Record<string, unknown>

  for (const [key, raw] of Object.entries(f)) {
    if (STRING_FIELDS.has(key)) {
      if (typeof raw !== "string") continue
      const v = raw.trim().slice(0, MAX_STRING)
      if (!v) {
        if (!NEVER_CLEAR.has(key)) data[key] = null
        continue
      }
      data[key] = v
      continue
    }
    if (key in ENUM_FIELDS) {
      if (typeof raw === "string" && ENUM_FIELDS[key]!.includes(raw))
        data[key] = raw
      continue
    }
    if (BLOCKS_FIELDS.has(key)) {
      if (typeof raw !== "string") continue
      const v = raw.trim().slice(0, MAX_STRING)
      data[key] = v ? toBlocks(v) : null
      continue
    }
    if (RELATION_SETS.has(key)) {
      if (!Array.isArray(raw)) continue
      data[key] = {
        set: raw.filter(isDocumentId).map((documentId) => ({ documentId })),
      }
      continue
    }
    if (key in HIERARCHY) {
      const relation = HIERARCHY[key]!
      if (raw === "" || raw === null) data[relation] = { set: [] }
      else if (isDocumentId(raw))
        data[relation] = { set: [{ documentId: raw }] }
      continue
    }
    if (key === "openingTimes") {
      if (raw === null || raw === "") {
        data.openingTimes = null
      } else if (
        raw &&
        typeof raw === "object" &&
        Array.isArray((raw as { days?: unknown }).days)
      ) {
        data.openingTimes = raw
      }
      continue
    }
    if (key === "socialLinks") {
      if (!Array.isArray(raw)) continue
      data.socialLinks = raw.flatMap((s) => {
        if (!s || typeof s !== "object") return []
        const { platform, url, label } = s as Record<string, unknown>
        if (typeof platform !== "string" || !SOCIAL_PLATFORMS.has(platform))
          return []
        if (typeof url !== "string" || !/^https?:\/\//i.test(url.trim()))
          return []

        return [
          {
            platform,
            url: url.trim().slice(0, 500),
            ...(typeof label === "string" && label.trim()
              ? { label: label.trim().slice(0, 120) }
              : {}),
          },
        ]
      })
      continue
    }
    if (key === "uploadedImages") {
      if (!Array.isArray(raw) || !opts.ownedUploadIds) continue
      const owned = raw.filter(
        (i): i is { strapiId: number; isHero?: boolean } =>
          !!i &&
          typeof i === "object" &&
          opts.ownedUploadIds!.has(
            Number((i as { strapiId?: unknown }).strapiId)
          )
      )
      if (owned.length === 0) continue
      const hero = owned.find((i) => i.isHero) ?? owned[0]!
      data.heroImage = { set: [{ id: Number(hero.strapiId) }] }
      const gallery = owned.filter((i) => i !== hero)
      if (gallery.length > 0)
        data.gallery = {
          connect: gallery.map((i) => ({ id: Number(i.strapiId) })),
        }
    }
  }

  // Coordinates travel as two strings; the record stores one point. Both
  // must be present and finite, or the pair is ignored.
  if ("lat" in f || "lng" in f) {
    const lat = num(f.lat)
    const lng = num(f.lng)
    if (
      lat !== null &&
      lng !== null &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180
    )
      data.location = { lat, lng }
    else if (f.lat === "" && f.lng === "") data.location = null
  }

  return data
}

type Submission = {
  documentId: string
  submissionType?: string
  submittedByUserId?: string
  targetDocumentId?: string | null
  targetSlug?: string | null
  fields?: unknown
}

/** The reviewed target: targetDocumentId when set, else the slug. */
async function findLibrary(strapi: any, submission: Submission) {
  const fields = ["documentId", "locale"]
  if (submission.targetDocumentId)
    return strapi.documents(LIBRARY).findOne({
      documentId: submission.targetDocumentId,
      fields,
    })
  if (!submission.targetSlug) return null
  const [library] = await strapi.documents(LIBRARY).findMany({
    filters: { slug: { $eq: submission.targetSlug } },
    fields,
    limit: 1,
  })

  return library ?? null
}

/**
 * Applies the record fields and publishes the library. "noop" when the
 * submission holds nothing valid or its library is gone. Database errors
 * propagate so the approval is reverted.
 */
export async function applyLibraryRecord(
  strapi: any,
  submission: Submission,
  ownedUploadIds?: Set<number>
): Promise<"applied" | "noop"> {
  const data = buildLibraryRecordData(submission.fields, { ownedUploadIds })
  if (Object.keys(data).length === 0) return "noop"

  const library = await findLibrary(strapi, submission)
  if (!library) {
    strapi.log.warn(
      `[content-moderation] record ${submission.documentId}: library not found; nothing applied`
    )

    return "noop"
  }

  const now = new Date()
  await strapi.documents(LIBRARY).update({
    documentId: library.documentId,
    locale: library.locale ?? undefined,
    status: "published",
    data: { ...data, contentUpdatedAt: now, lastVerifiedAt: now },
  })
  strapi.log.info(
    `[content-moderation] record ${submission.documentId}: applied ${Object.keys(data).join(", ")} to library ${library.documentId}`
  )

  return "applied"
}
