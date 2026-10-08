import {
  FACILITY_CHECKLIST,
  LOCALIZED_LIBRARY_FIELDS,
  MOBILE_FACILITY_CHECKLIST,
} from "@repo/shared-data"

import { latestStamp, sectionsSetBy, stampSections } from "./library-verify"
import { defaultLocale, normaliseLocale, submissionLocale } from "./locales"
import {
  isOptionKey,
  OPTION_UIDS,
  type OptionKey,
  recordSuggestion,
} from "./option-suggestions"
import { isDocumentId } from "./params"
import { applyToLocale, canonical } from "./publish-guard"
import {
  findOverlappingTimeframeIndexes,
  normalizeOpeningTimesValue,
  type OpeningTimesValue,
} from "../../../../customFields/openingTimes/shared"
import {
  assertTimetableHash,
  prepareMobileLibraryData,
  validatedTimetable,
} from "../../../../utils/mobile-timetable"

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
  "operatorName",
  "timetableUrl",
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

/** Every checklist label, in checklist order (the Mobile list after the branch one). */
const FACILITY_LABELS: readonly string[] = [
  ...FACILITY_CHECKLIST,
  ...MOBILE_FACILITY_CHECKLIST,
]
  .map((check) => check.label)
  .filter((label, index, all) => all.indexOf(label) === index)

/**
 * The library's `absentFacilities` from a submitted value: the checklist
 * labels the staff answered "No" to, with the same meaning as an approved
 * facilities correction (`utils/facility-answers`). Unknown or malformed
 * items are dropped, the rest return in checklist order; `null` or `""`
 * clears the list. `null` (not written) for anything that isn't a list.
 */
export function absentFacilityLabels(raw: unknown): string[] | null {
  if (raw === null || raw === "") return []
  if (!Array.isArray(raw)) return null
  const kept = new Set<string>()
  for (const item of raw)
    if (typeof item === "string" && FACILITY_LABELS.includes(item.trim()))
      kept.add(item.trim())

  return FACILITY_LABELS.filter((label) => kept.has(label))
}

const RELATION_SETS = new Set(["services", "amenities", "accessibility"])

/** Where each relation's options live, for new options a contributor names. */
export const OPTION_COLLECTIONS: Record<string, string> = OPTION_UIDS

const MAX_TIMEFRAMES_PER_DAY = 6
const MAX_SUGGESTED_OPTIONS = 5
const MAX_OPTION_NAME = 80

/**
 * Opening hours in the `global::opening-times` shape, via the custom
 * field's own normaliser: all seven days, valid 15-minute times, known
 * staffing. Null when the hours can't be stored as sent (overlapping or too
 * many timeframes), so nothing half-valid reaches the record.
 */
export function sanitizeOpeningTimes(raw: unknown): OpeningTimesValue | null {
  if (!raw || typeof raw !== "object") return null
  if (!Array.isArray((raw as { days?: unknown }).days)) return null
  const value = normalizeOpeningTimesValue(raw)
  for (const day of value.days) {
    if (day.timeframes.length > MAX_TIMEFRAMES_PER_DAY) return null
    if (findOverlappingTimeframeIndexes(day.timeframes).size > 0) return null
  }

  return value
}

const docIds = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.filter(isDocumentId))] : []

/**
 * A relation change: a full list (the Index editor's `set`) or a
 * correction's `{ connect, disconnect }`, which leaves the rest alone.
 */
function relationChange(raw: unknown) {
  if (Array.isArray(raw))
    return { set: docIds(raw).map((documentId) => ({ documentId })) }
  if (!raw || typeof raw !== "object") return null
  const { connect, disconnect } = raw as Record<string, unknown>
  const add = docIds(connect)
  const remove = docIds(disconnect).filter((id) => !add.includes(id))
  if (add.length === 0 && remove.length === 0) return null

  return {
    ...(add.length
      ? { connect: add.map((documentId) => ({ documentId })) }
      : {}),
    ...(remove.length
      ? { disconnect: remove.map((documentId) => ({ documentId })) }
      : {}),
  }
}

/**
 * New options a contributor suggested ("suggest a new one"), per relation:
 * trimmed, de-duplicated names, at most five each.
 */
export function parseSuggestedOptions(
  fields: unknown
): Record<string, string[]> {
  const raw =
    fields && typeof fields === "object"
      ? (fields as { suggestedOptions?: unknown }).suggestedOptions
      : null
  if (!raw || typeof raw !== "object") return {}
  const out: Record<string, string[]> = {}
  for (const key of Object.keys(OPTION_COLLECTIONS)) {
    const list = (raw as Record<string, unknown>)[key]
    if (!Array.isArray(list)) continue
    const seen = new Set<string>()
    const names = list.flatMap((n) => {
      if (typeof n !== "string") return []
      const name = n.trim().replaceAll(/\s+/g, " ").slice(0, MAX_OPTION_NAME)
      const k = name.toLowerCase()
      if (!name || seen.has(k)) return []
      seen.add(k)

      return [name]
    })
    if (names.length) out[key] = names.slice(0, MAX_SUGGESTED_OPTIONS)
  }

  return out
}

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

/** A link the record (and the admin) may follow: http or https only. */
export function isHttpUrl(v: unknown): v is string {
  return typeof v === "string" && /^https?:\/\//i.test(v.trim())
}

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

/**
 * The submitted keys `buildLibraryRecordData` accepts: its allowlist. Any
 * other key in a record edit's `fields` is never written.
 */
export const RECORD_FIELD_KEYS: ReadonlySet<string> = new Set([
  ...STRING_FIELDS,
  ...Object.keys(ENUM_FIELDS),
  ...BLOCKS_FIELDS,
  ...RELATION_SETS,
  ...Object.keys(HIERARCHY),
  "openingTimes",
  "mobileTimetable",
  "homeLibrary",
  "socialLinks",
  "uploadedImages",
  "absentFacilities",
  "lat",
  "lng",
])

/**
 * The library attributes a record edit's submitted `fields` name, through
 * `RECORD_FIELD_KEYS`: hierarchy ids become their relation, `lat`/`lng`
 * become `location`, uploads `heroImage`. Unknown keys are dropped, so junk
 * a contributor sent never reaches a public surface.
 */
export function recordFieldNames(fields: unknown): string[] {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return []
  const names = new Set<string>()
  for (const key of Object.keys(fields as Record<string, unknown>)) {
    if (!RECORD_FIELD_KEYS.has(key)) continue
    if (key in HIERARCHY) names.add(HIERARCHY[key]!)
    else if (key === "lat" || key === "lng") names.add("location")
    else if (key === "uploadedImages") names.add("heroImage")
    else names.add(key)
  }

  return [...names]
}

/** True for a `correction` that carries record fields (vs. facilities or free text). */
export function isRecordCorrection(fields: unknown): boolean {
  return (
    !!fields &&
    typeof fields === "object" &&
    (fields as { kind?: unknown }).kind === "record"
  )
}

export type VerifiedAction = "hours_verified" | "status_verified"

/**
 * The verification points an approved record edit earns: whoever set a
 * library's hours or its open status checked them. Clearing the hours or
 * setting the status to "unknown" checks nothing, and a translation can't
 * change either (both are shared by every locale version).
 */
export function verifiedActions(
  fields: unknown,
  localized: boolean,
  changed?: readonly string[]
): VerifiedAction[] {
  if (localized) return []
  const built = buildLibraryRecordData(fields)
  // When the apply said which fields changed, only those count: sending a
  // section's current value again checks nothing new.
  const data = changed
    ? Object.fromEntries(
        Object.entries(built).filter(([k]) => changed.includes(k))
      )
    : built
  const actions: VerifiedAction[] = []
  if (data.openingTimes) actions.push("hours_verified")
  if (data.operationalStatus && data.operationalStatus !== "unknown")
    actions.push("status_verified")

  return actions
}

export type LibraryRecordData = Record<string, unknown>

/**
 * The Strapi update payload for these submitted fields. Only allowlisted
 * keys survive; the result is empty when nothing valid was sent.
 */
export function buildLibraryRecordData(
  fields: unknown,
  opts: { ownedUploadIds?: Set<number>; skipMobileTimetable?: boolean } = {}
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
      const change = relationChange(raw)
      if (change) data[key] = change
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
      if (raw === null || raw === "") data.openingTimes = null
      else {
        const hours = sanitizeOpeningTimes(raw)
        if (hours) data.openingTimes = hours
      }
      continue
    }
    if (key === "mobileTimetable") {
      if (opts.skipMobileTimetable) continue
      data.mobileTimetable = validatedTimetable(raw)
      continue
    }
    if (key === "absentFacilities") {
      const labels = absentFacilityLabels(raw)
      if (labels) data.absentFacilities = labels
      continue
    }
    if (key === "homeLibrary") {
      if (raw === "" || raw === null) data.homeLibrary = { set: [] }
      else if (isDocumentId(raw))
        data.homeLibrary = { set: [{ documentId: raw }] }
      continue
    }
    if (key === "socialLinks") {
      if (!Array.isArray(raw)) continue
      data.socialLinks = raw.flatMap((s) => {
        if (!s || typeof s !== "object") return []
        const { platform, url, label } = s as Record<string, unknown>
        if (typeof platform !== "string" || !SOCIAL_PLATFORMS.has(platform))
          return []
        if (!isHttpUrl(url)) return []

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
  /** Stored name of the submission's locale (service layer: `locale`). */
  contentLocale?: string | null
  locale?: string | null
}

/**
 * The reviewed target: targetDocumentId when set, else the slug (shared by
 * every locale). Looked up in the default locale, which every library has;
 * the submission's own locale version may not exist yet.
 */
async function findLibrary(strapi: any, submission: Submission, base: string) {
  const fields = [
    "documentId",
    "locale",
    "name",
    "verifiedSections",
    "libraryType",
    "mobileTimetable",
    "location",
    "timezone",
  ]
  if (submission.targetDocumentId)
    return strapi.documents(LIBRARY).findOne({
      documentId: submission.targetDocumentId,
      locale: base,
      fields,
    })
  if (!submission.targetSlug) return null
  const [library] = await strapi.documents(LIBRARY).findMany({
    filters: { slug: { $eq: submission.targetSlug } },
    locale: base,
    fields,
    limit: 1,
  })

  return library ?? null
}

/**
 * For a non-default locale, only the fields that vary by locale: the rest
 * are shared by every locale version and are changed in the default one.
 * Returns the kept data and the dropped keys.
 */
export function localizedOnly(data: LibraryRecordData): {
  kept: LibraryRecordData
  dropped: string[]
} {
  const allowed = new Set(LOCALIZED_LIBRARY_FIELDS)
  const kept: LibraryRecordData = {}
  const dropped: string[] = []
  for (const [k, v] of Object.entries(data)) {
    if (allowed.has(k)) kept[k] = v
    else dropped.push(k)
  }

  return { kept, dropped }
}

/**
 * Links suggested names that match an existing published option, and
 * records the rest as suggestions for the editorial board (see
 * utils/option-suggestions), which contributors can vote on.
 */
async function resolveOptions(
  strapi: any,
  key: OptionKey,
  names: readonly string[],
  context: {
    library: { documentId: string; name: string }
    submissionId: string
    submittedBy?: string
  }
): Promise<string[]> {
  const ids: string[] = []
  for (const name of names) {
    const [existing] = await strapi.documents(OPTION_UIDS[key]).findMany({
      filters: { name: { $eqi: name } },
      fields: ["documentId"],
      status: "published",
      limit: 1,
    })
    if (existing?.documentId) ids.push(existing.documentId)
    else await recordSuggestion(strapi, { optionKey: key, name, ...context })
  }

  return ids
}

/** Relations a record edit changes by documentId. */
const DOCUMENT_RELATIONS: ReadonlySet<string> = new Set([
  ...RELATION_SETS,
  ...Object.values(HIERARCHY),
  "homeLibrary",
])
/** Media a record edit changes by upload id. */
const MEDIA_RELATIONS: ReadonlySet<string> = new Set(["heroImage", "gallery"])
/** Components, read whole. */
const COMPONENTS: ReadonlySet<string> = new Set(["socialLinks"])

/** A value without its row ids or empty keys, so stored and sent copies compare. */
function withoutIds(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(withoutIds)
  if (!v || typeof v !== "object") return v

  return Object.fromEntries(
    Object.entries(v as Record<string, unknown>)
      .filter(
        ([k, x]) =>
          k !== "id" && k !== "__component" && x !== null && x !== undefined
      )
      .map(([k, x]) => [k, withoutIds(x)])
  )
}

/** Opening hours by their days and times; timeframe ids are random per save. */
function hoursKey(v: unknown): string {
  if (!v || typeof v !== "object" || !Array.isArray((v as any).days))
    return canonical(null)

  return canonical(
    normalizeOpeningTimesValue(v).days.map((d) => ({
      day: d.day,
      enabled: d.enabled,
      timeframes: d.timeframes.map(({ startTime, endTime, staffing }) => ({
        startTime,
        endTime,
        staffing,
      })),
    }))
  )
}

function locationKey(v: unknown): string {
  const o = v as { lat?: unknown; lng?: unknown } | null | undefined
  const lat = num(o?.lat)
  const lng = num(o?.lng)

  return lat === null || lng === null ? canonical(null) : `${lat},${lng}`
}

/** The ids a relation holds now: one entry, a list, or nothing. */
function linked(current: unknown, key: "documentId" | "id"): Set<string> {
  const list = Array.isArray(current) ? current : current ? [current] : []

  return new Set(
    list.flatMap((x) => {
      const v = (x as Record<string, unknown> | null)?.[key]

      return v === null || v === undefined ? [] : [String(v)]
    })
  )
}

/** True when a relation change links or unlinks anything. */
function relationChanges(
  change: unknown,
  current: unknown,
  key: "documentId" | "id"
): boolean {
  const now = linked(current, key)
  const c = (change ?? {}) as Record<string, unknown>
  const ids = (list: unknown) =>
    (Array.isArray(list) ? list : []).map((x) =>
      String((x as Record<string, unknown> | null)?.[key])
    )
  if (Array.isArray(c.set)) {
    const next = new Set(ids(c.set))

    return next.size !== now.size || [...next].some((id) => !now.has(id))
  }

  return (
    ids(c.connect).some((id) => !now.has(id)) ||
    ids(c.disconnect).some((id) => now.has(id))
  )
}

/**
 * The library attributes in `data` whose value differs from `current` (the
 * library as it is): hours by their times, a location by its coordinates,
 * relations only when they link or unlink something, everything else by
 * value. A field sent with its current value isn't a change.
 */
export function changedFields(
  data: LibraryRecordData,
  current: Record<string, unknown>
): string[] {
  return Object.keys(data).filter((k) => {
    const next = data[k]
    const now = current[k]
    if (k === "openingTimes") return hoursKey(next) !== hoursKey(now)
    if (k === "location") return locationKey(next) !== locationKey(now)
    if (DOCUMENT_RELATIONS.has(k))
      return relationChanges(next, now, "documentId")
    if (MEDIA_RELATIONS.has(k)) return relationChanges(next, now, "id")

    return canonical(withoutIds(next)) !== canonical(withoutIds(now))
  })
}

/**
 * The published values of the fields `data` writes, in that locale: what
 * readers see now. Empty when that locale has no published version yet.
 */
async function currentValues(
  strapi: any,
  documentId: string,
  locale: string,
  data: LibraryRecordData
): Promise<Record<string, unknown>> {
  const keys = Object.keys(data)
  const populated = keys.filter(
    (k) =>
      DOCUMENT_RELATIONS.has(k) || MEDIA_RELATIONS.has(k) || COMPONENTS.has(k)
  )
  const scalars = keys.filter((k) => !populated.includes(k))
  const row = await strapi.documents(LIBRARY).findOne({
    documentId,
    locale,
    status: "published",
    fields: ["documentId", ...scalars],
    ...(populated.length > 0
      ? {
          populate: Object.fromEntries(
            populated.map((k) => [
              k,
              COMPONENTS.has(k)
                ? true
                : {
                    fields: [DOCUMENT_RELATIONS.has(k) ? "documentId" : "id"],
                  },
            ])
          ),
        }
      : {}),
  })

  return row ?? {}
}

/**
 * Filled in by `applyLibraryRecord`: the library attributes the edit
 * actually changed, for scoring. Empty when nothing was applied.
 */
export type RecordChangeReport = { changed: string[] }

/**
 * "applied_draft": the change reached the library's draft version only,
 * because the draft already held unpublished edits (see utils/publish-guard).
 */
export type ApplyRecordOutcome = "applied" | "applied_draft" | "noop"

/**
 * Applies the record fields and publishes the library. "noop" when the
 * submission holds nothing valid or its library is gone. With a `report`,
 * it also says which fields actually changed. Database errors propagate so
 * the approval is reverted, and so does `ApplyRefusedError` when the
 * library has no published version.
 */
export async function applyLibraryRecord(
  strapi: any,
  submission: Submission,
  ownedUploadIds?: Set<number>,
  report?: RecordChangeReport
): Promise<ApplyRecordOutcome> {
  if (report) report.changed = []
  const base = await defaultLocale(strapi)
  const locale = await normaliseLocale(strapi, submissionLocale(submission))
  const localized = locale !== base
  let data = buildLibraryRecordData(submission.fields, {
    ownedUploadIds,
    skipMobileTimetable: localized,
  })
  // Option suggestions are shared relations: they belong to the default
  // locale, so a translation never raises one.
  const suggested = localized ? {} : parseSuggestedOptions(submission.fields)
  if (localized) {
    const { kept, dropped } = localizedOnly(data)
    if (dropped.length > 0)
      strapi.log.info(
        `[content-moderation] record ${submission.documentId}: ${locale} change ignores shared fields ${dropped.join(", ")}`
      )
    data = kept
  }
  if (Object.keys(data).length === 0 && Object.keys(suggested).length === 0)
    return "noop"

  const library = await findLibrary(strapi, submission, base)
  if (!library) {
    strapi.log.warn(
      `[content-moderation] record ${submission.documentId}: library not found; nothing applied`
    )

    return "noop"
  }
  if (
    !localized &&
    Object.prototype.hasOwnProperty.call(data, "mobileTimetable")
  ) {
    const fields = submission.fields as Record<string, unknown>
    // A suggestion made from a timetable the submitter loaded carries its
    // hash; once that timetable has changed (a staff edit, say) the change
    // is refused, whichever submission type carried it.
    if (fields.previousHash != null) {
      const published = await strapi.documents(LIBRARY).findOne({
        documentId: library.documentId,
        locale: base,
        status: "published",
        fields: ["mobileTimetable"],
      })
      assertTimetableHash(
        published?.mobileTimetable ?? library.mobileTimetable,
        fields.previousHash
      )
    }
  }
  if (
    !localized &&
    (Object.prototype.hasOwnProperty.call(data, "mobileTimetable") ||
      Object.prototype.hasOwnProperty.call(data, "homeLibrary"))
  )
    data = await prepareMobileLibraryData(strapi, data, library, base)

  // Suggested names: an existing option is connected alongside the rest; a
  // new one joins the editorial board's suggestions, open to votes.
  for (const [key, names] of Object.entries(suggested)) {
    if (!isOptionKey(key)) continue
    const ids = await resolveOptions(strapi, key, names, {
      library: {
        documentId: library.documentId,
        name: library.name ?? library.documentId,
      },
      submissionId: submission.documentId,
      submittedBy: submission.submittedByUserId,
    })
    if (ids.length === 0) continue
    const change = (data[key] ?? {}) as {
      set?: { documentId: string }[]
      connect?: { documentId: string }[]
    }
    const extra = ids.map((documentId) => ({ documentId }))
    data[key] = change.set
      ? { set: [...change.set, ...extra] }
      : { ...change, connect: [...(change.connect ?? []), ...extra] }
  }

  // Only new names were suggested: they're logged, the record is unchanged.
  if (Object.keys(data).length === 0) return "applied"

  // Read before the write: which fields differ from what readers see now.
  if (report)
    report.changed = changedFields(
      data,
      await currentValues(strapi, library.documentId, locale, data)
    )

  // The timestamps are shared by every locale version: a translation leaves
  // them to the default locale's own changes. Setting a verifiable section
  // (hours, status, address, contact) checks it: it's stamped, and
  // lastVerifiedAt follows the latest stamp (see utils/library-verify).
  const now = new Date()
  const touched = sectionsSetBy(data)
  const stamps = touched.length
    ? stampSections(library.verifiedSections, touched, now)
    : null
  const payload = localized
    ? data
    : {
        ...data,
        contentUpdatedAt: now,
        ...(stamps
          ? { verifiedSections: stamps, lastVerifiedAt: latestStamp(stamps) }
          : {}),
      }
  const { mode } = await applyToLocale(
    strapi,
    LIBRARY,
    library.documentId,
    payload,
    { locale, defaultLocale: base }
  )
  strapi.log.info(
    `[content-moderation] record ${submission.documentId}: applied ${Object.keys(data).join(", ")} to library ${library.documentId} (${locale})${mode === "draft_only" ? " (draft only)" : ""}`
  )

  return mode === "draft_only" ? "applied_draft" : "applied"
}
