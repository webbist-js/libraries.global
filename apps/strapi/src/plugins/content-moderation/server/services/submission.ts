import {
  submittedSourceRecords,
  proposedDrive,
  validateDrive,
} from "@repo/shared-data"

import createNotifications, { scheduleNotification } from "./notifications"
import { isActivityPublic } from "../../../../utils/activity-visibility"
import {
  grantVerifiedLibrarian,
  upsertAffiliation,
} from "../../../../utils/affiliations"
import { articleRevision } from "../../../../utils/article-content"
import {
  articleDraftMedia,
  pinArticleBase,
  submissionArticle,
} from "../../../../utils/article-relations"
import {
  type ChangeContext,
  runWithChangeContext,
} from "../../../../utils/change-context"
import { createGrant } from "../../../../utils/role-grants"
import {
  type ApplyArticleOutcome,
  type ApplyArticleResult,
  applyArticleSubmission,
  applyArticleSubmissionWithResult,
  isTranslationSubmission,
} from "../utils/article-apply"
import { applyDriveProposal } from "../utils/drive-proposal"
import { applyFacilityAnswers } from "../utils/facility-answers"
import {
  applyLibraryPhoto,
  isPhotoCorrection,
  photoIdOf,
} from "../utils/library-photo"
import {
  applyLibraryRecord,
  type ApplyRecordOutcome,
  isHttpUrl,
  isRecordCorrection,
  type RecordChangeReport,
  verifiedActions,
} from "../utils/library-record"
import {
  applyVerification,
  isVerification,
  latestStamp,
  sectionsSetBy,
  stampSections,
  verifySections,
} from "../utils/library-verify"
import {
  configuredLocales,
  defaultLocale,
  normaliseLocale,
  submissionLocale,
} from "../utils/locales"
import {
  isDocumentId,
  isNewArticleDraft,
  roleApplicationFields,
  validateRoleApplicationFields,
} from "../utils/params"
import { payloadHash } from "../utils/payload-hash"
import {
  ApplyRefusedError,
  type ApplyRefusedReason,
  isApplyRefusedError,
} from "../utils/publish-guard"
import {
  preloadRecordReviews,
  preloadTopicReviews,
  recordReview,
} from "../utils/record-review"
import { isSelfReview, type Reviewer } from "../utils/reviewer"
import {
  applyStaffLibraryCreation,
  staffCreationOf,
  type StaffLibraryCreation,
} from "../utils/staff-library-creation"
import {
  staffReviewHint,
  claimReview,
  preloadStaffReviewHints,
} from "../utils/staff-review-hint"
import { withTargetLabels } from "../utils/target-labels"
import { applyTopicSuggestion } from "../utils/topic-suggestion"
import { canTransition } from "../utils/transitions"
import { ownedUploadIds } from "../utils/uploads"

import submissionSchema from "../content-types/submission/schema.json"

// Appended to reviewNote when an article approval didn't publish anything
// by itself, so the moderator knows the next step. `skipped_suggestion`:
// a reader's wiki_edit carried a direct-edit body (docs.directEdit re-check
// failed at apply time), nothing was applied. `drafted` / `created_draft`:
// the change was written to the article's draft version (or a new draft
// article) and needs publishing from the Content Manager.
export const SUGGESTION_MARKER =
  " [Suggestion — not auto-applied; apply manually]"
export const DRAFTED_MARKER =
  " [Applied to the article's draft; publish it from the Content Manager]"
export const CREATED_DRAFT_MARKER =
  " [Created as a draft article; publish it from the Content Manager]"

// The publish guard (utils/publish-guard) wrote the change to the record's
// draft version only, because the draft already held an admin's unpublished
// edits; publishing the draft from the Content Manager releases both.
export const DRAFT_ONLY_MARKER =
  " [Applied to the draft; the record has unpublished admin edits]"
// The publish guard refused: the record has no published version, so the
// approval was returned to review. Publish the record, then approve again.
export const NOT_PUBLISHED_MARKER =
  " [Not applied: the record is not published. Publish it in the Content Manager, then approve again]"
// A `new_library` approved with `publish` had no continent, country or region
// (or they didn't give it a real entityRef): set the target, then approve again.
export const NO_HIERARCHY_MARKER =
  " [Not published: the library needs a continent, country and region. Set its location, then approve again]"
// An event_feed approval found the submitter without a claim on the library.
export const CLAIM_LOST_MARKER =
  " [Not applied: the submitter no longer holds a claim on this library. Reject it instead]"
// An event_feed approval found its credential no longer waiting on it.
export const FEED_MISMATCH_MARKER =
  " [Not applied: this feed is no longer waiting on this submission. Reject it instead]"
// A drive_proposal approval found its definition no longer makes a valid
// drive (with the Moderator's dates, if they set any).
export const INVALID_DRIVE_MARKER =
  " [Not applied: the drive isn’t valid as proposed. Change its dates, or reject it]"

const REFUSED_MARKERS: Record<ApplyRefusedReason, string> = {
  not_published: NOT_PUBLISHED_MARKER,
  no_hierarchy: NO_HIERARCHY_MARKER,
  claim_lost: CLAIM_LOST_MARKER,
  feed_mismatch: FEED_MISMATCH_MARKER,
  invalid_drive: INVALID_DRIVE_MARKER,
  stale_article:
    " [Not applied: the article changed since this revision started. Ask the writer to reload and compare before resubmitting]",
  invalid_media:
    " [Not applied: an image does not belong to this writer or the existing published article]",
}

/** The dates a Moderator gives a `drive_proposal`'s drive. */
export type ModeratorEdit = { startsAt: string; endsAt: string }

/** The places a `new_library` is filed under. */
export const HIERARCHY_KEYS = [
  "continent",
  "country",
  "region",
  "area",
] as const
export type HierarchyKey = (typeof HIERARCHY_KEYS)[number]
export type ModeratorTarget = Partial<Record<HierarchyKey, string>>

export const HIERARCHY_UIDS: Record<HierarchyKey, string> = {
  continent: "api::continent.continent",
  country: "api::country.country",
  region: "api::region.region",
  area: "api::area.area",
}

/** Submission types a Moderator may set the hierarchy of before approval. */
export const TARGETABLE_TYPES: ReadonlySet<string> = new Set(["new_library"])

/** The documentIds `src` holds under `${place}${suffix}`; anything else dropped. */
function pickPlaces(src: Record<string, unknown>, suffix: string) {
  const out: ModeratorTarget = {}
  for (const k of HIERARCHY_KEYS) {
    const v = src[`${k}${suffix}`]
    if (isDocumentId(v)) out[k] = v
  }

  return out
}

const asObject = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {}

/**
 * `draftData` keys only a Moderator writes, through `setModeratorTarget`.
 * A contributor's draftData never carries them: `create`, `saveDraft` and
 * `finalizeDraft` drop them, so a submitter can't file their own library on
 * approval.
 */
const MODERATOR_KEYS: readonly string[] = [
  "moderatorTarget",
  "moderatorEdit",
  // The "Staff request" queue chip: set only by the staff publish path
  // (`create({ requestedByStaff: true })`), never from a submitted body.
  "requestedByStaff",
  "staffCreation",
]

export function withoutModeratorKeys<T>(draftData: T): T {
  if (!draftData || typeof draftData !== "object" || Array.isArray(draftData))
    return draftData
  if (!MODERATOR_KEYS.some((k) => k in (draftData as object))) return draftData

  return Object.fromEntries(
    Object.entries(draftData as Record<string, unknown>).filter(
      ([k]) => !MODERATOR_KEYS.includes(k)
    )
  ) as T
}

/** The Moderator's `draftData.moderatorTarget`, valid ids only. */
export function moderatorTargetOf(draftData: unknown): ModeratorTarget {
  return pickPlaces(asObject(asObject(draftData).moderatorTarget), "")
}

/**
 * Where a new library is filed: the Moderator's `draftData.moderatorTarget`
 * when it names any place (it replaces the submitter's choice as a whole, so
 * a region and an area from two different picks never mix), else the
 * submitter's `fields.*DocumentId`. Unknown values are dropped.
 */
export function libraryHierarchy(submission: {
  fields?: unknown
  draftData?: unknown
}): ModeratorTarget {
  const target = moderatorTargetOf(submission.draftData)
  if (Object.keys(target).length > 0) return target

  return pickPlaces(asObject(submission.fields), "DocumentId")
}

/** A URL slug for a name; falls back to `fallback` ("library"). */
function librarySlug(name: string, fallback = "library"): string {
  const s = name
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036F]/g, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .slice(0, 80)

  return s || fallback
}

/** A library slug no other library holds. */
async function uniqueLibrarySlug(strapi: any, base: string): Promise<string> {
  const rows = (await strapi.documents("api::library.library").findMany({
    filters: { slug: { $startsWith: base } },
    fields: ["slug"],
    sort: "id:asc",
    limit: 500,
  })) as { slug?: string }[]
  const taken = new Set(rows.map((r) => r.slug))
  if (!taken.has(base)) return base
  for (let n = 2; n < 1000; n++)
    if (!taken.has(`${base}-${n}`)) return `${base}-${n}`

  return `${base}-${Date.now()}`
}

const ARTICLE_MARKERS: Partial<Record<ApplyArticleOutcome, string>> = {
  skipped_suggestion: SUGGESTION_MARKER,
  drafted: DRAFTED_MARKER,
  drafted_divergent: DRAFT_ONLY_MARKER,
  created_draft: CREATED_DRAFT_MARKER,
}

/**
 * Article outcomes that changed something and so may earn points. `noop`
 * (unknown locale, missing target, nothing to write) and
 * `skipped_suggestion` (a reader's direct edit, not applied) never do.
 */
const APPLIED_ARTICLE_OUTCOMES: ReadonlySet<ApplyArticleOutcome> =
  new Set<ApplyArticleOutcome>([
    "published",
    "drafted",
    "drafted_divergent",
    "created_published",
    "created_draft",
  ])

const RECORD_MARKERS: Partial<Record<ApplyRecordOutcome, string>> = {
  applied_draft: DRAFT_ONLY_MARKER,
}

/** `note` with `marker` appended once. */
function withMarker(note: string | null | undefined, marker: string): string {
  const base = note ?? ""

  return base.includes(marker) ? base : `${base}${marker}`
}

// Evidence types that point at a public document. Only these are shown in a
// library's public revision history; the rest may identify a person.
const PUBLIC_EVIDENCE_TYPES = new Set(["institutional_url", "press_release"])

export function publicEvidenceUrl(
  evidenceType: string | null | undefined,
  evidenceUrl: string | null | undefined
): string | null {
  if (!evidenceType || !PUBLIC_EVIDENCE_TYPES.has(evidenceType)) return null
  const url = evidenceUrl?.trim()

  return url && /^https?:\/\//i.test(url) ? url : null
}

// Library schema fields that count toward the library_edit points tier.
// Anything else in `fields` (unknown keys, typos, injected junk) is ignored
// so points can't be inflated by padding the payload.
const LIBRARY_FIELDS = new Set([
  "name",
  "shortName",
  "summary",
  "libraryType",
  "operationalStatus",
  "operatorType",
  "streetAddress",
  "city",
  "district",
  "postalCode",
  "website",
  "catalogueUrl",
  "planVisitUrl",
  "membershipUrl",
  "bookingUrl",
  "donationUrl",
  "virtualTourUrl",
  "email",
  "phone",
  "admissionInfo",
  "transitInfo",
  "languagesServed",
  "foundedYear",
  "openedYear",
  "closedYear",
  "architect",
  "buildingInfo",
  "iiifEndpoint",
  "classificationSystem",
  "openingTimes",
  "mobileTimetable",
  "homeLibrary",
  "operatorName",
  "timetableUrl",
  "accessibilityNotes",
  "visitNotes",
  "services",
  "amenities",
  "accessibility",
  "location",
])

/**
 * The keys of a draft/finalize body that are stored as their own columns
 * rather than inside `fields`. Anything else in the body is a library (or
 * article) field. Shared by `saveDraft`, `finalizeDraft` and the finalize
 * controller's content check so the check always sees what gets written.
 */
export const SUBMISSION_EXTRA_KEYS = [
  "editSummary",
  "evidenceType",
  "evidenceUrl",
  "note",
] as const

export type SubmissionExtras = Partial<
  Record<(typeof SUBMISSION_EXTRA_KEYS)[number], unknown>
>

/**
 * The points for an approved library edit (a claimant's `library_edit`, or a
 * structured record `correction` — C-L1 applies both the same way), from
 * the `LIBRARY_FIELDS` the apply actually changed (`applyLibraryRecord`'s
 * report): 1–3 score a minor edit, 4+ a major one. Fields sent with their
 * current value don't count, so padding a correction earns nothing; one
 * that changes nothing earns the base correction points.
 */
function editAction(changed: readonly string[]): {
  action: "edit_accepted_minor" | "edit_accepted_major" | "correction_approved"
  points: number
  fieldCount: number
} {
  const fieldCount = changed.filter((k) => LIBRARY_FIELDS.has(k)).length
  if (fieldCount === 0)
    return { action: "correction_approved", points: 2, fieldCount }

  return fieldCount >= 4
    ? { action: "edit_accepted_major", points: 15, fieldCount }
    : { action: "edit_accepted_minor", points: 5, fieldCount }
}

const SUBMISSION_UID = "plugin::content-moderation.submission"
/** hours_verified and status_verified, each (rewards "How it works"). */
const VERIFIED_POINTS = 5
const PROFILE_UID = "api::user-profile.user-profile"
const REVIEW_EVENT_UID = "plugin::content-moderation.review-event"

/**
 * The plugin's notifications service, built directly when it isn't
 * registered (or a stub stands in for it), so a transition always reaches
 * the never-throwing implementation.
 */
function notifications(strapi: any): ReturnType<typeof createNotifications> {
  let registered: any = null
  try {
    registered = strapi
      .plugin?.("content-moderation")
      ?.service?.("notifications")
  } catch {
    registered = null
  }

  return typeof registered?.submissionDecided === "function" &&
    typeof registered?.submissionPending === "function"
    ? registered
    : createNotifications({ strapi })
}

/**
 * Applies an approved Role Application: one Role Grant per requested
 * locale, or one for every locale when it named none; a Moderator's grants
 * carry the queue applied for. Returns the
 * applicant's profile documentId. Throws (rolling the approval back) when
 * the role isn't one an application may grant or the applicant has no
 * profile.
 */
async function applyRoleApplication(
  strapi: any,
  submission: any,
  reviewer: Reviewer
): Promise<string> {
  const { role, queue, locales } = roleApplicationFields(submission.fields)
  if (!role)
    throw new Error(
      `role_application ${submission.documentId} names no role an application can grant`
    )
  if (role === "moderator" && !queue)
    throw new Error(
      `role_application ${submission.documentId} asks to moderate no queue`
    )
  const baUserId = String(submission.submittedByUserId ?? "")
  const [profile] = baUserId
    ? ((await strapi.documents(PROFILE_UID).findMany({
        filters: { baUserId: { $eq: baUserId } },
        fields: ["documentId"],
        limit: 1,
      })) as { documentId: string }[])
    : []
  if (!profile)
    throw new Error(
      `role_application ${submission.documentId}: the applicant has no profile`
    )

  for (const locale of locales.length > 0 ? locales : [null])
    await createGrant(strapi, {
      baUserId,
      role,
      ...(role === "moderator" && queue ? { queue } : {}),
      locale,
      source: "application",
      grantedBy: reviewer.id,
      reason: `Approved application ${submission.documentId}`,
    })
  strapi.log.info(
    `[content-moderation] Granted ${role}${queue ? ` of the ${queue} queue` : ""} (${locales.length > 0 ? locales.join(", ") : "all locales"}) from approved application ${submission.documentId}`
  )

  return profile.documentId
}

/** Records one Submission State change (see the review-event schema). */
async function writeReviewEvent(
  strapi: any,
  e: {
    submissionDocumentId: string
    fromStatus: string
    toStatus: string
    reviewerId: string
    reviewerKind: Reviewer["kind"]
    note?: string | null
  }
): Promise<void> {
  await strapi.documents(REVIEW_EVENT_UID as any).create({
    data: { ...e, note: e.note ?? null },
  })
}

/** The statuses an admin may filter the queue by. Never `draft`. */
const REVIEW_STATUSES = new Set([
  "pending",
  "approved",
  "rejected",
  "needs_info",
])

/** Default column lengths when the schema names none: string 255, text 10k. */
const STRING_MAX = 255
const TEXT_MAX = 10_000

type ExtrasVerdict =
  | { ok: true; extras: SubmissionExtras }
  | { ok: false; message: string }

/**
 * Checks the extras against the submission schema: `evidenceType` must be
 * one of its enum values, strings are capped at their column length (an
 * over-long link is refused rather than truncated into a broken one), and
 * anything that isn't a string is dropped. Unknown keys never get here
 * (`splitSubmissionBody` sends them to `fields`).
 */
export function validateSubmissionExtras(
  strapi: any,
  extras: SubmissionExtras
): ExtrasVerdict {
  const attributes: Record<string, any> =
    strapi?.contentType?.(SUBMISSION_UID)?.attributes ??
    submissionSchema.attributes
  const out: SubmissionExtras = {}

  if (extras.evidenceType !== undefined && extras.evidenceType !== null) {
    const allowed: readonly string[] = attributes.evidenceType?.enum ?? []
    if (
      typeof extras.evidenceType !== "string" ||
      !allowed.includes(extras.evidenceType)
    )
      return { ok: false, message: "Unknown evidence type." }
    out.evidenceType = extras.evidenceType
  }

  const cap = (key: "editSummary" | "evidenceUrl" | "note") => {
    const v = extras[key]
    if (typeof v !== "string") return null
    const attr = attributes[key] ?? {}
    const max: number =
      typeof attr.maxLength === "number"
        ? attr.maxLength
        : attr.type === "text"
          ? TEXT_MAX
          : STRING_MAX

    return { v, max }
  }
  const summary = cap("editSummary")
  if (summary) out.editSummary = summary.v.slice(0, summary.max)
  const note = cap("note")
  if (note) out.note = note.v.slice(0, note.max)
  const url = cap("evidenceUrl")
  if (url) {
    if (url.v.length > url.max)
      return { ok: false, message: "That evidence link is too long." }
    out.evidenceUrl = url.v
  }

  return { ok: true, extras: out }
}

export function splitSubmissionBody(body: unknown): {
  fields: Record<string, unknown>
  extras: SubmissionExtras
  /** True when the body carried at least one non-extra key. */
  hasFields: boolean
} {
  const safe =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {}
  const fields: Record<string, unknown> = {}
  const extras: SubmissionExtras = {}
  for (const [key, value] of Object.entries(safe)) {
    if (MODERATOR_KEYS.includes(key)) continue
    if ((SUBMISSION_EXTRA_KEYS as readonly string[]).includes(key))
      extras[key as keyof SubmissionExtras] = value
    else fields[key] = value
  }

  return { fields, extras, hasFields: Object.keys(fields).length > 0 }
}

/**
 * Selects the exact row `saveDraft`/`finalizeDraft` just read, by pinning
 * both the status *and* the revision counter it observed. `status:"draft"`
 * alone doesn't close the race between them: saveDraft never changes
 * status, so a concurrent saveDraft can still land between finalize's
 * policy check and finalize's own compare-and-set write while both see
 * status:"draft" the whole time. Pinning draftRevision (bumped only by
 * saveDraft — finalizeDraft never increments it, relying instead on its
 * own status change from "draft" to "pending" to close the race) means
 * only the caller that read the current revision can win the write;
 * everyone else's compare-and-set matches zero rows. Rows written before
 * this field existed may have `draftRevision` as null.
 */
function revisionWhere(existing: {
  draftRevision?: number | null
}): Record<string, unknown> {
  return existing.draftRevision == null
    ? { draftRevision: { $null: true } }
    : { draftRevision: existing.draftRevision }
}

/**
 * M2: strips internal fields (`payloadHash`, `draftRevision`) before a
 * submission is returned to any client, and names the stored
 * `contentLocale` `locale` (Strapi reserves `locale` as an attribute name).
 * Passes null/undefined through.
 */
export function toClient<T>(sub: T): T {
  if (!sub || typeof sub !== "object") return sub
  const {
    payloadHash: _payloadHash,
    draftRevision: _draftRevision,
    contentLocale,
    ...rest
  } = sub as Record<string, unknown>

  return (
    contentLocale === undefined ? rest : { ...rest, locale: contentLocale }
  ) as T
}

/**
 * `toClient` for the submitter's own views (create, drafts, finalize,
 * `/submissions/my`): also drops `reviewedByUserId`, which names the
 * Moderator who decided it. Admin and moderation responses keep it.
 */
export function toContributor<T>(sub: T): T {
  const client = toClient(sub)
  if (!client || typeof client !== "object") return client
  const { reviewedByUserId: _reviewer, ...rest } = client as Record<
    string,
    unknown
  >

  return rest as T
}

/**
 * The locale a new or finalized submission is stored with: `locale` from
 * the request when given, else (articles) the draft's `locale`, else what
 * the row already holds; always a configured locale, the default otherwise.
 * A Role Application is always filed in the default locale: the languages
 * it asks for are `fields.locales`, and moderation scope reads those
 * (`canModerateApplication`), never a locale the client picked. A Drive
 * Proposal is too: drive text is written in the default locale.
 */
export async function resolveSubmissionLocale(
  strapi: any,
  requested: unknown,
  row: {
    submissionType?: unknown
    draftData?: unknown
    contentLocale?: unknown
  } = {}
): Promise<string> {
  if (
    row.submissionType === "role_application" ||
    row.submissionType === "drive_proposal"
  )
    return defaultLocale(strapi)
  const isArticle =
    row.submissionType === "wiki_edit" ||
    row.submissionType === "blog_submission"
  const draftLocale =
    isArticle && row.draftData && typeof row.draftData === "object"
      ? (row.draftData as { locale?: unknown }).locale
      : undefined

  return normaliseLocale(
    strapi,
    typeof requested === "string" && requested
      ? requested
      : (draftLocale ?? submissionLocale(row))
  )
}

// NOTE: `status` on a submission is the moderation status (draft/pending/
// approved/rejected/needs_info) and is stored correctly in cm_submissions.
// Strapi's content-manager (and tools built on it, like the MCP) overlays its
// own document `status` key in list responses, so they show "published".
// Read moderation state through this plugin's routes, not the content-manager.
export default ({ strapi }: { strapi: any }) => ({
  async create(data: {
    submissionType: string
    targetEntityType?: string
    targetDocumentId?: string
    targetSlug?: string
    fields?: Record<string, unknown>
    draftData?: Record<string, unknown>
    note?: string
    verificationMethod?: string
    editSummary?: string
    evidenceType?: string
    evidenceUrl?: string
    submittedByUserId: string
    submittedByEmail: string
    submittedByName?: string
    asDraft?: boolean
    /** Stored as `contentLocale`; normalised to a configured locale. */
    locale?: unknown
    /** The Drive this change is tagged to, checked by the policy. */
    driveDocumentId?: string
    /**
     * False skips scheduling the `submissionPending` alert here; the caller
     * takes it over with `notifyPending` once its own transaction (the one
     * `create` was called inside) has committed. Default true.
     */
    notify?: boolean
    /**
     * Internal: marks a moderated field request filed by library staff. The
     * controller never forwards it, so a contributor cannot forge the chip.
     */
    requestedByStaff?: boolean
    /** Internal: authenticated new-library staff intent, checked by the controller. */
    staffCreation?: StaffLibraryCreation
  }) {
    const {
      asDraft,
      locale,
      notify = true,
      requestedByStaff = false,
      staffCreation,
      ...fields
    } = data
    // An application is stored as validated: trimmed, de-duplicated, and
    // without the keys its role ignores (the policy already checked it).
    if (fields.submissionType === "role_application") {
      const parsed = validateRoleApplicationFields(
        fields.fields,
        await configuredLocales(strapi)
      )
      if (parsed.ok) fields.fields = parsed.value
    }
    const status = asDraft ? "draft" : "pending"
    const draftData = staffCreation
      ? { ...withoutModeratorKeys(fields.draftData ?? {}), staffCreation }
      : requestedByStaff
        ? {
            ...withoutModeratorKeys(fields.draftData ?? {}),
            requestedByStaff: true,
          }
        : fields.draftData === undefined
          ? undefined
          : withoutModeratorKeys(fields.draftData)
    const rest = {
      ...fields,
      ...(draftData === undefined ? {} : { draftData }),
      // An application is always about the applicant's own profile; the
      // client's value is ignored.
      ...(fields.submissionType === "role_application"
        ? { targetEntityType: "user_profile" }
        : {}),
      // A Drive Proposal's target is the drive approval creates.
      ...(fields.submissionType === "drive_proposal"
        ? { targetEntityType: "drive" }
        : {}),
      contentLocale: await resolveSubmissionLocale(strapi, locale, fields),
    }

    const pinned = await pinArticleBase(strapi, rest)
    const created = await strapi
      .documents("plugin::content-moderation.submission")
      .create({
        data: {
          ...pinned,
          status,
          ...(status === "pending" ? { payloadHash: payloadHash(pinned) } : {}),
        },
      })
    if (status === "pending" && notify)
      scheduleNotification(strapi, `alert for ${created.documentId}`, () =>
        notifications(strapi).submissionPending(created)
      )

    // The library is now in review, which the task panel already excludes —
    // this just frees a 20-minute hold early so another helper can pick it
    // up sooner, rather than waiting it out.
    if (
      status === "pending" &&
      typeof created.driveDocumentId === "string" &&
      created.driveDocumentId &&
      typeof created.targetDocumentId === "string" &&
      created.targetDocumentId
    ) {
      try {
        await strapi
          .service("api::drive.drive")
          .releaseHold(created.driveDocumentId, created.targetDocumentId)
      } catch (err) {
        strapi.log.warn("[content-moderation] drive hold release failed:", err)
      }
    }

    return toContributor(await articleDraftMedia(strapi, created))
  },

  /**
   * Schedules exactly the alert `create` would have for a submission that
   * reached `pending`, for a caller that passed `notify: false` because the
   * row was created inside its own transaction: `create`'s scheduled task
   * (queued with `setImmediate`) could otherwise run before that transaction
   * commits, or after it rolls back. Call this only once the transaction has
   * resolved.
   */
  notifyPending(submission: any): void {
    scheduleNotification(strapi, `alert for ${submission.documentId}`, () =>
      notifications(strapi).submissionPending(submission)
    )
  },

  async findAll(status?: unknown) {
    // A review status only: drafts are private until finalized, and a
    // non-string (an object from `?status[$ne]=`) would be a filter, not a
    // value. Anything else means "everything in or past review".
    const wanted =
      typeof status === "string" && REVIEW_STATUSES.has(status)
        ? status
        : { $ne: "draft" }
    const filters: Record<string, unknown> = { status: wanted }

    // Default to all non-draft statuses when no filter is specified
    const rows = await strapi
      .documents("plugin::content-moderation.submission")
      .findMany({
        filters,
        sort: { createdAt: "desc" },
        limit: 200,
      })

    // Record corrections still to review get the library's live values and
    // option names, so the moderator never relies on the contributor's; a
    // topic suggestion gets the topic its target points at. The lookups are
    // batched per page: one library query, one per option list, one for
    // topics.
    const open = (rows ?? []).filter(
      (row: any) => row.status === "pending" || row.status === "needs_info"
    )
    const [preloaded, topics, staffHints] = await Promise.all([
      preloadRecordReviews(strapi, open),
      preloadTopicReviews(strapi, open),
      preloadStaffReviewHints(strapi, open),
    ])

    return Promise.all(
      (rows ?? []).map(async (row: any) => {
        const hint = await staffReviewHint(strapi, row, staffHints)
        const claim =
          row.submissionType === "library_claim"
            ? await claimReview(strapi, row).catch(() => null)
            : null
        const client = {
          ...toClient(row),
          ...(hint ? { staffReviewHint: hint } : {}),
          ...(claim?.team ? { teamReview: claim.team } : {}),
        }
        if (!open.includes(row)) return client
        const review =
          row.submissionType === "topic_suggestion"
            ? (topics.get(row.targetDocumentId) ?? null)
            : await recordReview(strapi, row, preloaded).catch(() => null)

        return review ? { ...client, review } : client
      })
    )
  },

  async findByUser(userId: string, documentId?: string) {
    const rows = await strapi
      .documents("plugin::content-moderation.submission")
      .findMany({
        filters: {
          submittedByUserId: userId,
          ...(documentId ? { documentId } : {}),
        },
        sort: { createdAt: "desc" },
        limit: documentId ? 1 : 100,
      })

    // Drive tags for the rows that carry one, one query for the page.
    const driveMap: Map<string, unknown> =
      (await strapi
        .plugin("content-moderation")
        ?.service("moderation")
        ?.driveTitles?.((rows ?? []).map((r: any) => r.driveDocumentId))) ??
      new Map()

    // Named like the public list on the profile: library names and article
    // titles, not slugs.
    return (await withTargetLabels(strapi, rows ?? [])).map((r: any) => ({
      ...toContributor(r),
      drive: r.driveDocumentId
        ? (driveMap.get(r.driveDocumentId) ?? null)
        : null,
    }))
  },

  async updateStatus(
    documentId: string,
    status: "approved" | "rejected" | "needs_info" | "pending",
    reviewer: Reviewer,
    reviewNote?: string,
    // "Approve and publish" (Moderators, Task 11): an article suggestion or
    // new article is published, and a new library is published with its
    // hierarchy. The caller checks the reviewer may publish it.
    opts: { publish?: boolean } = {}
  ): Promise<
    | {
        error:
          | "not_found"
          | "self_review"
          | "invalid_transition"
          | "conflict"
          | "tampered"
          | "apply_failed"
        // Set on apply_failed when the revert itself failed: the submission
        // is still at the new status, with none of its side effects applied.
        unreverted?: true
      }
    // The publish guard refused the apply (the target isn't published); the
    // submission is back at its prior status with a reviewNote saying why.
    | { error: "apply_refused"; reason: ApplyRefusedError["reason"] }
    | { data: unknown }
  > {
    const submission = await strapi
      .documents("plugin::content-moderation.submission")
      .findOne({ documentId })
    if (!submission) return { error: "not_found" }
    // No self-review, decided before anything is written.
    if (isSelfReview(reviewer, submission)) return { error: "self_review" }
    if (!canTransition(submission.status, status))
      return { error: "invalid_transition" }
    if (
      status === "approved" &&
      submission.payloadHash &&
      submission.payloadHash !== payloadHash(submission)
    )
      return { error: "tampered" }

    // Snapshot the pre-CAS values as primitives: after a rollback we confirm
    // against exactly this, not whatever `submission` might read later.
    const priorStatus = submission.status
    const priorReviewNote = submission.reviewNote ?? null

    const reviewedAt = new Date()
    const reviewedByUserId = reviewer.id
    // Every apply below writes as the submitter, approved by `reviewer`; the
    // change-records middleware reads this for Change Records.
    const changeContext: ChangeContext = {
      source: "submission",
      actorKind: "contributor",
      actorId: `ba:${submission.submittedByUserId}`,
      actorName: submission.submittedByName ?? null,
      reviewerId: reviewer.id,
      submissionDocumentId: submission.documentId ?? documentId,
      editSummary: submission.editSummary ?? null,
    }

    // Built from the pre-CAS snapshot, not re-read from the db. `payloadHash`
    // is a private field and must never be echoed back to admin clients.
    const updated: Record<string, unknown> = toClient({
      ...submission,
      status,
      reviewedByUserId,
      reviewNote,
      reviewedAt,
    })
    let articleTranslation = false
    // What the article apply actually did; points depend on it, never on
    // the submission alone (a `noop` or a skipped suggestion earns nothing).
    let articleOutcome: ApplyArticleOutcome | null = null
    // The library fields a record edit actually changed (filled by the
    // apply); its points depend on them, not on the fields it sent.
    const recordChange: RecordChangeReport = { changed: [] }

    // The status change and everything it applies (library, article,
    // affiliation, role, review markers) commit together: a throw anywhere
    // rolls the lot back, so the submission can never be left "approved"
    // with half its effects. Points and quick wins come after the commit.
    let outcome: "ok" | "conflict"
    try {
      outcome = await strapi.db.transaction(async () => {
        // Compare-and-set: only one concurrent request can move it out of
        // `priorStatus`. Submissions have draftAndPublish:false, so the db
        // layer sees the same row as documents(). Also pin the payloadHash
        // (when one was recorded) so a request built against a stale review
        // can't win the race either.
        const { count } = await strapi.db
          .query("plugin::content-moderation.submission")
          .updateMany({
            where: {
              documentId,
              status: priorStatus,
              ...(submission.payloadHash
                ? { payloadHash: submission.payloadHash }
                : {}),
            },
            data: { status, reviewedByUserId, reviewNote, reviewedAt },
          })
        if (count !== 1) return "conflict" as const

        // The Review Event commits (or rolls back) with the status change.
        await writeReviewEvent(strapi, {
          submissionDocumentId: documentId,
          fromStatus: priorStatus,
          toStatus: status,
          reviewerId: reviewer.id,
          reviewerKind: reviewer.kind,
          note: reviewNote ?? null,
        })

        return runWithChangeContext(changeContext, async () => {
          // Side-effect: if approving a new_library, create a draft library entry
          if (
            status === "approved" &&
            submission?.submissionType === "new_library"
          ) {
            const f = (submission.fields ?? {}) as Record<string, unknown>
            const tempRef = `PENDING-${Date.now()}`

            // Convert plain-text notes to Strapi blocks format
            const toBlocks = (text: unknown) =>
              text
                ? [
                    {
                      type: "paragraph",
                      children: [{ type: "text", text: String(text) }],
                    },
                  ]
                : undefined

            // Uploaded images: find hero and gallery
            type UploadedImage = {
              strapiId: number
              url: string
              isHero: boolean
            }
            const claimed = Array.isArray(f.uploadedImages)
              ? (f.uploadedImages as UploadedImage[])
              : []
            // A2: only attach files this submitter uploaded through the submission flow.
            const owned = await (this as any).ownedUploadIds(
              submission.submittedByUserId,
              claimed.map((i) => Number(i.strapiId)).filter(Number.isInteger)
            )
            const uploadedImages = claimed.filter((i) =>
              owned.has(Number(i.strapiId))
            )
            const heroImage =
              uploadedImages.find((img) => img.isHero) ??
              uploadedImages[0] ??
              null
            const galleryImages = uploadedImages.filter(
              (img) => img !== heroImage
            )

            // Social links: a platform and an http(s) link, nothing else (the
            // admin renders these as links, and so does the site).
            const socialLinksData = Array.isArray(f.socialLinks)
              ? (
                  f.socialLinks as {
                    platform: string
                    url: string
                    label?: string
                  }[]
                ).filter(
                  (s) =>
                    !!s &&
                    typeof s === "object" &&
                    typeof s.platform === "string" &&
                    !!s.platform &&
                    isHttpUrl(s.url)
                )
              : []
            // Link fields likewise: anything but http(s) is dropped.
            const link = (v: unknown) => (isHttpUrl(v) ? v.trim() : undefined)
            // Relation targets must be documentIds; unknown ones are dropped
            // before `connect` so a bad id can't fail (or misdirect) the create.
            const ids = (v: unknown) =>
              Array.isArray(v) ? [...new Set(v.filter(isDocumentId))] : []
            const connectIds = (v: unknown) => {
              const list = ids(v)

              return list.length > 0
                ? { connect: list.map((documentId) => ({ documentId })) }
                : undefined
            }
            const connectOne = (v: unknown) =>
              isDocumentId(v) ? { connect: [{ documentId: v }] } : undefined
            // The Moderator's target, else the submitter's ids.
            const place = libraryHierarchy(submission)
            const publishLibrary = opts.publish === true
            // A published library needs a real entityRef, which needs the
            // continent, country and region. Refused before anything is
            // written; the transaction rolls the approval back.
            if (
              publishLibrary &&
              (!place.continent || !place.country || !place.region)
            )
              throw new ApplyRefusedError(
                "no_hierarchy",
                "api::library.library",
                documentId
              )
            const name = String(f.name ?? "Unnamed Library")

            // Tracks the draft library once it's created, so the catch below
            // can clean it up if a later step in this block (e.g. the proposer
            // affiliation) throws — otherwise the library survives the revert
            // and a retry creates another one alongside it.
            let createdLibraryDocumentId: string | undefined
            try {
              const libraryData: Record<string, unknown> = {
                name,
                // Publishing validates the required slug; a draft gets
                // one from the Content Manager.
                ...(publishLibrary
                  ? {
                      slug: await uniqueLibrarySlug(strapi, librarySlug(name)),
                    }
                  : {}),
                libraryType: (f.libraryType as string) ?? "Other",
                operationalStatus: (f.operationalStatus as string) ?? "unknown",
                operatorType: (f.operatorType as string) || undefined,
                entityRef: tempRef,
                shortName: (f.shortName as string) || undefined,
                summary: (f.summary as string) || undefined,
                streetAddress: (f.streetAddress as string) || undefined,
                city: (f.city as string) || undefined,
                district: (f.district as string) || undefined,
                postalCode: (f.postalCode as string) || undefined,
                website: link(f.website),
                catalogueUrl: link(f.catalogueUrl),
                planVisitUrl: link(f.planVisitUrl),
                membershipUrl: link(f.membershipUrl),
                bookingUrl: link(f.bookingUrl),
                donationUrl: link(f.donationUrl),
                virtualTourUrl: link(f.virtualTourUrl),
                virtualTourEmbed: (f.virtualTourEmbed as string) || undefined,
                email: (f.email as string) || undefined,
                phone: (f.phone as string) || undefined,
                admissionInfo: (f.admissionInfo as string) || undefined,
                transitInfo: (f.transitInfo as string) || undefined,
                languagesServed: (f.languagesServed as string) || undefined,
                foundedYear: (f.foundedYear as string) || undefined,
                openedYear: (f.openedYear as string) || undefined,
                closedYear: (f.closedYear as string) || undefined,
                architect: (f.architect as string) || undefined,
                buildingInfo: (f.buildingInfo as string) || undefined,
                iiifEndpoint: link(f.iiifEndpoint),
                classificationSystem:
                  (f.classificationSystem as string) || undefined,
                sourceRecords: submittedSourceRecords(f.sourceRecords),
                closureReason: (f.closureReason as string) || undefined,
                openingTimes: f.openingTimes || undefined,
                ...(f.libraryType === "Mobile"
                  ? {
                      mobileTimetable: f.mobileTimetable ?? undefined,
                      homeLibrary: connectOne(f.homeLibrary),
                      operatorName:
                        typeof f.operatorName === "string"
                          ? f.operatorName.trim() || undefined
                          : undefined,
                      timetableUrl: link(f.timetableUrl),
                    }
                  : {}),
                accessibilityNotes: toBlocks(f.accessibilityNotes),
                visitNotes: toBlocks(f.visitNotes),
                contentUpdatedAt: new Date(),
                location:
                  f.lat && f.lng
                    ? {
                        lat: Number.parseFloat(String(f.lat)),
                        lng: Number.parseFloat(String(f.lng)),
                      }
                    : undefined,
                continent: connectOne(place.continent),
                country: connectOne(place.country),
                region: connectOne(place.region),
                area: connectOne(place.area),
                heroImage: heroImage
                  ? { connect: [{ id: heroImage.strapiId }] }
                  : undefined,
                gallery:
                  galleryImages.length > 0
                    ? {
                        connect: galleryImages.map((img) => ({
                          id: img.strapiId,
                        })),
                      }
                    : undefined,
                socialLinks:
                  socialLinksData.length > 0 ? socialLinksData : undefined,
                services: connectIds(f.services),
                amenities: connectIds(f.amenities),
                accessibility: connectIds(f.accessibility),
              }
              // The verifiable sections it sets (hours, status, address,
              // contact) are checked by this approval: each is stamped and
              // lastVerifiedAt is the latest stamp. Setting none checks
              // nothing (see utils/library-verify).
              const checked = sectionsSetBy(libraryData)
              if (checked.length > 0) {
                const stamps = stampSections(null, checked, new Date())
                libraryData.verifiedSections = stamps
                libraryData.lastVerifiedAt = latestStamp(stamps)
              }
              const newLibrary = await strapi
                .documents("api::library.library")
                .create({
                  // A new library starts in the default locale; translations
                  // are corrections to it.
                  locale: await defaultLocale(strapi),
                  data: libraryData,
                  status: "draft",
                })
              createdLibraryDocumentId = newLibrary.documentId
              strapi.log.info(
                `[content-moderation] Auto-created draft library "${f.name}" from approved submission ${documentId}`
              )

              if (publishLibrary) {
                // The entityRef lifecycle replaces the PENDING- reference
                // once the hierarchy resolves; if it didn't, the ids named
                // no real places and the library must not go live.
                const created = await strapi
                  .documents("api::library.library")
                  .findOne({
                    documentId: newLibrary.documentId,
                    fields: ["documentId", "entityRef"] as any,
                  })
                const ref = String(created?.entityRef ?? tempRef)
                if (ref.startsWith("PENDING-"))
                  throw new ApplyRefusedError(
                    "no_hierarchy",
                    "api::library.library",
                    newLibrary.documentId
                  )
                await strapi.documents("api::library.library").update({
                  documentId: newLibrary.documentId,
                  locale: await defaultLocale(strapi),
                  status: "published",
                  data: {},
                })
                strapi.log.info(
                  `[content-moderation] Published library ${newLibrary.documentId} from approved submission ${documentId}`
                )
              }

              // Ordinary proposals grant no staff access. A staff creation
              // includes a claim in the moderator's review, applied atomically.
              if (submission.submittedByUserId && newLibrary?.documentId) {
                const creation = staffCreationOf(submission.draftData)
                await (creation
                  ? applyStaffLibraryCreation(
                      strapi,
                      submission.submittedByUserId,
                      newLibrary.documentId,
                      creation
                    )
                  : upsertAffiliation(strapi, {
                      baUserId: submission.submittedByUserId,
                      libraryDocumentId: newLibrary.documentId,
                      role: "proposer",
                      verificationMethod: "contact_us",
                    }))
                strapi.log.info(
                  `[content-moderation] Recorded ${creation ? "staff owner" : "proposer"} affiliation for library "${f.name}" (submitter ${submission.submittedByUserId})`
                )
              }

              // What the approval produced, for the submitter's history.
              await strapi
                .documents("plugin::content-moderation.submission")
                .update({
                  documentId,
                  data: { resultDocumentId: newLibrary.documentId },
                })
              updated.resultDocumentId = newLibrary.documentId
            } catch (err) {
              // I1: rethrow so the outer catch reverts the approval. A retry is
              // safe: the proposer affiliation is an upsert, and — per the
              // cleanup just below — a library this block created doesn't
              // survive a later failure, so a retry can't leave duplicates.
              if (createdLibraryDocumentId) {
                // The library was created; something after it (the proposer
                // affiliation) threw. Leaving the draft in place would orphan
                // it: the approval reverts to pending, but a retry would create
                // a second draft library alongside this one.
                try {
                  await strapi
                    .documents("api::library.library")
                    .delete({ documentId: createdLibraryDocumentId })
                  strapi.log.info(
                    `[content-moderation] Removed orphaned draft library ${createdLibraryDocumentId} after submission ${documentId} approval failed`
                  )
                } catch (cleanupErr) {
                  strapi.log.error(
                    `[content-moderation] Failed to remove orphaned draft library ${createdLibraryDocumentId} after submission ${documentId} approval failed`,
                    cleanupErr
                  )
                }
                strapi.log.error(
                  `[content-moderation] new_library submission ${documentId} approval failed after the library was created; reverting`,
                  err
                )
              } else {
                strapi.log.error(
                  `[content-moderation] Failed to auto-create library from approved submission ${documentId}:`,
                  err
                )
              }
              throw err
            }
          }

          // Side-effect: if approving a library_claim, create affiliation record + mark profile verified
          if (
            status === "approved" &&
            submission?.submissionType === "library_claim"
          ) {
            const fields = (submission.fields ?? {}) as Record<string, unknown>

            // A2: resolve by the reviewed targetDocumentId, never fields.entityRef.
            const targetLibrary = submission.targetDocumentId
              ? await strapi.documents("api::library.library").findOne({
                  documentId: submission.targetDocumentId,
                  fields: ["documentId"] as any,
                })
              : null
            if (!targetLibrary) {
              strapi.log.warn(
                `[content-moderation] claim ${documentId} has no valid targetDocumentId; skipping affiliation`
              )
            } else {
              // A claim an unverified Team's organiser filed by assigning a
              // member carries the level and member to record; any other
              // claim (including an ordinary vouched one) is a plain claim.
              const teamContext = await strapi
                .plugin("access")
                ?.service("teams")
                ?.claimContext(submission)
              const affiliation = await upsertAffiliation(strapi, {
                baUserId: submission.submittedByUserId,
                libraryDocumentId: targetLibrary.documentId,
                ...(teamContext
                  ? {
                      staffRole: teamContext.staffRole,
                      source: "team" as const,
                      teamMemberDocumentId: teamContext.teamMemberDocumentId,
                    }
                  : {}),
                // Pass through undefined (not null) when the claim didn't supply
                // a value, so an update doesn't null out an existing one.
                role: fields.role as string | undefined,
                department: fields.department as string | undefined,
                verificationMethod:
                  (submission.verificationMethod as string) ?? "contact_us",
              })
              try {
                await grantVerifiedLibrarian(
                  strapi,
                  submission.submittedByUserId
                )
              } catch (err) {
                // I3: compensate — the approval is about to be reverted, so an
                // affiliation this call created must not survive it. (An
                // existing row that was only updated is left in place.)
                if (affiliation?.created && affiliation.documentId) {
                  try {
                    await strapi
                      .documents("api::library-affiliation.library-affiliation")
                      .delete({ documentId: affiliation.documentId })
                  } catch (cleanupErr) {
                    strapi.log.error(
                      `[content-moderation] claim ${documentId}: failed to remove affiliation ${affiliation.documentId} after grant failure`,
                      cleanupErr
                    )
                  }
                }
                throw err
              }
            }
          }

          // Side-effect: an approved topic_suggestion creates its topic, or
          // approves the one that has that name (A2: a named target is the
          // reviewed targetDocumentId, never fields.topicDocumentId).
          if (
            status === "approved" &&
            submission?.submissionType === "topic_suggestion"
          ) {
            const topicId = await applyTopicSuggestion(strapi, submission)
            if (topicId) {
              await strapi
                .documents("plugin::content-moderation.submission")
                .update({ documentId, data: { resultDocumentId: topicId } })
              updated.resultDocumentId = topicId
            } else {
              strapi.log.warn(
                `[content-moderation] topic_suggestion ${documentId} names no topic; nothing applied`
              )
            }
          }

          // Side-effect: an approved correction is applied to the library and
          // published: "Tap Yes or No" facility answers connect facilities, and
          // a record correction from the Index editor (fields.kind "record")
          // writes the changed fields (C-L1), a shared photo joins the
          // library's images, and a "Still right?" verify stamps the sections
          // it confirms. Free-text corrections still only award points.
          if (
            status === "approved" &&
            (submission?.submissionType === "correction" ||
              submission?.submissionType === "library_edit")
          ) {
            // A claimant's approved library_edit is applied the same way as a
            // record correction (C-L1).
            const outcome: ApplyRecordOutcome =
              submission.submissionType === "library_edit" ||
              isRecordCorrection(submission.fields) ||
              (submission.fields as any)?.kind === "source"
                ? await (this as any).applyLibraryRecord(
                    submission,
                    recordChange
                  )
                : isPhotoCorrection(submission.fields)
                  ? await (this as any).applyLibraryPhoto(submission)
                  : isVerification(submission.fields)
                    ? await applyVerification(strapi, submission)
                    : await (this as any).applyFacilityAnswers(submission)
            const marker = RECORD_MARKERS[outcome]
            if (marker) {
              const noted = withMarker(reviewNote, marker)
              await strapi
                .documents("plugin::content-moderation.submission")
                .update({ documentId, data: { reviewNote: noted } })
              updated.reviewNote = noted
            }
          }

          // ── wiki_edit / blog_submission approval ──────────────────────────
          if (
            status === "approved" &&
            (submission?.submissionType === "wiki_edit" ||
              submission?.submissionType === "blog_submission")
          ) {
            // Decided before the apply creates the locale version (B4).
            articleTranslation = await isTranslationSubmission(
              strapi,
              submission,
              submission.submissionType === "wiki_edit" ? "wiki" : "journal"
            )
            const applied: ApplyArticleResult = await (
              this as any
            ).applyArticle(
              submission,
              submission.submissionType === "wiki_edit" ? "wiki" : "journal",
              { publish: opts.publish }
            )
            const outcome = applied.outcome
            articleOutcome = outcome
            if (
              applied.documentId &&
              (outcome === "created_published" || outcome === "created_draft")
            ) {
              await strapi
                .documents("plugin::content-moderation.submission")
                .update({
                  documentId,
                  data: { resultDocumentId: applied.documentId },
                })
              updated.resultDocumentId = applied.documentId
            }
            const marker = ARTICLE_MARKERS[outcome]
            if (marker) {
              // `reviewNote` here is the argument this call received — the
              // moderator's note the compare-and-set above just wrote. Reading
              // it off the pre-CAS `submission` snapshot instead would silently
              // discard that note, since the snapshot predates the write.
              const noted = withMarker(reviewNote, marker)
              await strapi
                .documents("plugin::content-moderation.submission")
                .update({ documentId, data: { reviewNote: noted } })
              updated.reviewNote = noted
            }
          }

          // ── role_application approval ─────────────────────────────────────
          // Grants the role (the role-grant lifecycle re-derives the profile's
          // role and drops the cached session). No points.
          if (
            status === "approved" &&
            submission?.submissionType === "role_application"
          ) {
            const profileDocumentId = await applyRoleApplication(
              strapi,
              submission,
              reviewer
            )
            await strapi
              .documents("plugin::content-moderation.submission")
              .update({
                documentId,
                data: { resultDocumentId: profileDocumentId },
              })
            updated.resultDocumentId = profileDocumentId
          }

          // ── drive_proposal approval ───────────────────────────────────────
          // Creates the drive as scheduled (ADR-0005: approval only
          // schedules it). An invalid drive refuses, rolling this back.
          if (
            status === "approved" &&
            submission?.submissionType === "drive_proposal"
          ) {
            const driveDocumentId = await applyDriveProposal(strapi, submission)
            await strapi
              .documents("plugin::content-moderation.submission")
              .update({
                documentId,
                data: { resultDocumentId: driveDocumentId },
              })
            updated.resultDocumentId = driveDocumentId
          }

          // ── event_feed ───────────────────────────────────────────────────
          // The events plugin owns the credential: approval activates the
          // value under review, rejection destroys it. Both run in this
          // transaction.
          if (submission?.submissionType === "event_feed") {
            const feeds = strapi.plugin("events").service("feeds")
            if (status === "approved") {
              const { credentialDocumentId } = await feeds.approveSubmission(
                submission,
                reviewer.id
              )
              await strapi
                .documents("plugin::content-moderation.submission")
                .update({
                  documentId,
                  data: { resultDocumentId: credentialDocumentId },
                })
              updated.resultDocumentId = credentialDocumentId
            } else if (status === "rejected") {
              await feeds.rejectSubmission(submission, reviewer.id)
            }
          }

          return "ok" as const
        })
      })
    } catch (err) {
      // A side effect threw (or the publish guard refused): the transaction
      // rolled back the compare-and-set along with it, so the submission is
      // back at `priorStatus` and the review can be retried. Confirm that
      // rather than assume it: a failed rollback would leave the row stuck
      // at `status` with none of its effects applied.
      const refused = isApplyRefusedError(err)
      if (refused)
        strapi.log.warn(
          `[content-moderation] updateStatus for ${documentId} refused (${err.reason}: ${err.uid} ${err.documentId}); rolled back to "${priorStatus}"`
        )
      else
        strapi.log.error(
          `[content-moderation] updateStatus side effects failed for ${documentId}; rolled back to "${priorStatus}"`,
          err
        )
      let reverted = false
      try {
        const after = await strapi
          .documents("plugin::content-moderation.submission")
          .findOne({ documentId })
        reverted = after?.status === priorStatus
      } catch (readErr) {
        strapi.log.error(
          `[content-moderation] could not confirm the rollback of ${documentId}`,
          readErr
        )
      }
      if (!reverted) {
        strapi.log.error(
          `[content-moderation] approval revert failed; submission left approved without side effects (${documentId}, status "${status}")`
        )

        return { error: "apply_failed", unreverted: true }
      }
      if (refused) {
        // A refusal leaves the moderator a note saying what to do. Outside
        // the transaction: it must survive the rollback.
        try {
          await strapi
            .documents("plugin::content-moderation.submission")
            .update({
              documentId,
              data: {
                reviewNote: withMarker(
                  priorReviewNote,
                  REFUSED_MARKERS[err.reason]
                ),
              },
            })
        } catch (noteErr) {
          strapi.log.warn(
            `[content-moderation] could not note the refusal on ${documentId}`,
            noteErr
          )
        }

        return { error: "apply_refused", reason: err.reason }
      }

      return { error: "apply_failed" }
    }
    if (outcome === "conflict") return { error: "conflict" }

    {
      // Award points for new_library approval — non-fatal
      if (
        status === "approved" &&
        submission?.submissionType === "new_library"
      ) {
        try {
          await strapi
            .plugin("rewards")
            .service("points")
            .award(
              submission.submittedByUserId,
              "new_library_approved",
              50,
              {
                submissionId: documentId,
                libraryName: String(
                  (submission.fields as Record<string, unknown>)?.name ?? ""
                ),
              },
              `${documentId}:new_library_approved`
            )
        } catch (err) {
          strapi.log.warn("[content-moderation] rewards.award failed:", err)
        }
      }

      // Award points for library_edit approval (minor: 1–3 fields, major: 4+)
      if (
        status === "approved" &&
        submission?.submissionType === "library_edit"
      ) {
        try {
          const { action, points, fieldCount } = editAction(
            recordChange.changed
          )

          await strapi
            .plugin("rewards")
            .service("points")
            .award(
              submission.submittedByUserId,
              action,
              points,
              { submissionId: documentId, fieldCount },
              `${documentId}:${action}`
            )
        } catch (err) {
          strapi.log.warn(
            "[content-moderation] rewards.award (edit) failed:",
            err
          )
        }
      }

      // Award points for correction approval. Hub photos and sources travel
      // as tagged corrections, so score them for what they are: a CC photo
      // 8pts, a source 3pts, anything else 2pts.
      if (
        status === "approved" &&
        submission?.submissionType === "correction" &&
        ((submission.fields as any)?.kind !== "source" ||
          recordChange.changed.includes("sourceRecords"))
      ) {
        try {
          const fields = submission.fields as Record<string, unknown>
          const kind = fields?.kind
          const edit = isRecordCorrection(fields)
            ? editAction(recordChange.changed)
            : null
          const [action, pts] = edit
            ? ([edit.action, edit.points] as const)
            : kind === "photo"
              ? (["photo_licensed_cc", 8] as const)
              : kind === "source"
                ? (["source_added", 3] as const)
                : (["correction_approved", 2] as const)
          await strapi
            .plugin("rewards")
            .service("points")
            .award(
              submission.submittedByUserId,
              action,
              pts,
              edit
                ? { submissionId: documentId, fieldCount: edit.fieldCount }
                : { submissionId: documentId },
              `${documentId}:${action}`
            )
        } catch (err) {
          strapi.log.warn(
            "[content-moderation] rewards.award (correction) failed:",
            err
          )
        }
      }

      // Setting a library's hours or open status checks them, and so does
      // confirming them with a "Still right?" verify: each earns its
      // verification points on top of the edit's own, which the Shelf
      // Check, Verifier and Lending Library badges count.
      if (
        status === "approved" &&
        (submission?.submissionType === "library_edit" ||
          (submission?.submissionType === "correction" &&
            isRecordCorrection(submission.fields)) ||
          (submission?.submissionType === "correction" &&
            isVerification(submission.fields)))
      ) {
        try {
          const base = await defaultLocale(strapi)
          const locale = await normaliseLocale(
            strapi,
            submissionLocale(submission)
          )
          // A claimant's library_edit is a record edit whatever its kind.
          const verify =
            submission.submissionType === "correction" &&
            isVerification(submission.fields)
          const actions = verify
            ? verifySections(submission.fields).flatMap((s) =>
                s === "hours"
                  ? (["hours_verified"] as const)
                  : s === "status"
                    ? (["status_verified"] as const)
                    : []
              )
            : verifiedActions(
                submission.fields,
                locale !== base,
                recordChange.changed
              )
          for (const action of actions) {
            await strapi
              .plugin("rewards")
              .service("points")
              .award(
                submission.submittedByUserId,
                action,
                VERIFIED_POINTS,
                { submissionId: documentId },
                `${documentId}:${action}`
              )
          }
        } catch (err) {
          strapi.log.warn(
            "[content-moderation] rewards.award (verified) failed:",
            err
          )
        }
      }

      // Award points for library_claim approval — 10pts
      if (
        status === "approved" &&
        submission?.submissionType === "library_claim"
      ) {
        try {
          await strapi.plugin("rewards").service("points").award(
            submission.submittedByUserId,
            "claim_approved",
            10,
            {
              submissionId: documentId,
            },
            `${documentId}:claim_approved`
          )
        } catch (err) {
          strapi.log.warn(
            "[content-moderation] rewards.award (claim) failed:",
            err
          )
        }
      }

      // Award points for an accepted Drive Proposal — 10pts
      if (
        status === "approved" &&
        submission?.submissionType === "drive_proposal"
      ) {
        try {
          await strapi.plugin("rewards").service("points").award(
            submission.submittedByUserId,
            "drive_proposal_accepted",
            10,
            {
              submissionId: documentId,
              driveDocumentId: updated.resultDocumentId,
            },
            `${documentId}:drive_proposal_accepted`
          )
        } catch (err) {
          strapi.log.warn(
            "[content-moderation] rewards.award (drive proposal) failed:",
            err
          )
        }
      }

      // Award points for Knowledge and Journal approvals: a new article
      // earns the most, a translation next, an edit to an existing one least.
      // "New" comes from `draftData.kind` and "translation" from the target
      // article's locales, never from contributor-controlled `fields`; and
      // only when the apply did something (see `APPLIED_ARTICLE_OUTCOMES`).
      if (
        status === "approved" &&
        (submission?.submissionType === "wiki_edit" ||
          submission?.submissionType === "blog_submission") &&
        articleOutcome !== null &&
        APPLIED_ARTICLE_OUTCOMES.has(articleOutcome)
      ) {
        try {
          const isNew = isNewArticleDraft(submission.draftData)
          // Knowledge: the target's locales decide. Journal: the editor
          // marks a translation (`draftData.isTranslation`), and the
          // target's locales must agree, so a flag alone earns nothing.
          const isTranslation =
            submission.submissionType === "wiki_edit"
              ? articleTranslation
              : articleTranslation &&
                (submission.draftData as Record<string, unknown> | null)
                  ?.isTranslation === true
          const [action, pts] =
            submission.submissionType === "wiki_edit"
              ? isNew
                ? (["knowledge_article_published", 25] as const)
                : isTranslation
                  ? (["wiki_translated", 15] as const)
                  : (["knowledge_edit_accepted", 8] as const)
              : isNew
                ? (["journal_accepted", 30] as const)
                : isTranslation
                  ? (["journal_translated", 15] as const)
                  : (["journal_edit_accepted", 8] as const)
          await strapi
            .plugin("rewards")
            .service("points")
            .award(
              submission.submittedByUserId,
              action,
              pts,
              { submissionId: documentId },
              `${documentId}:${action}`
            )
        } catch (err) {
          strapi.log.warn(
            "[content-moderation] rewards.award (article) failed:",
            err
          )
        }
      }

      // Credit the Drives this approved change filled a gap for — tagged,
      // or inferred from scope and focus (Task 5). After the commit and
      // off the request path; never fails the transition.
      if (
        status === "approved" &&
        (submission?.submissionType === "correction" ||
          submission?.submissionType === "library_edit")
      ) {
        try {
          await strapi.service("api::drive.drive").creditApproval(submission)
        } catch (err) {
          strapi.log.warn(
            "[content-moderation] drive creditApproval failed:",
            err
          )
        }
      }

      // After the commit and off the request path; never fails the
      // transition. A decision tells the submitter (with the moderator's own
      // note, not the markers appended for moderators); a resubmission from
      // needs_info alerts the moderators like a first submission does.
      if (status === "pending") {
        scheduleNotification(strapi, `alert for ${documentId}`, () =>
          notifications(strapi).submissionPending(submission)
        )
      } else if (reviewer.kind !== "system") {
        // A `system` decision (withdrawing or clearing a pending Submission
        // when the library disconnects or replaces its feed) isn't a
        // moderator's review: it never tells the submitter their own
        // request was "rejected".
        const decided = { ...submission, reviewNote: reviewNote ?? null }
        scheduleNotification(strapi, `${status} email for ${documentId}`, () =>
          notifications(strapi).submissionDecided(decided, status)
        )
      }
    }

    return { data: updated }
  },

  async saveDraft(
    documentId: string,
    userId: string,
    draftData: Record<string, unknown>,
    stepCompleted: number
  ): Promise<
    | { error: "not_found" | "forbidden" | "not_draft" }
    | { error: "invalid"; message: string }
    | { data: unknown }
  > {
    const existing = await strapi
      .documents("plugin::content-moderation.submission")
      .findOne({ documentId })
    if (!existing) return { error: "not_found" }
    if (existing.submittedByUserId !== userId) return { error: "forbidden" }
    // A1: once a submission is in review (or decided) its content is frozen.
    if (existing.status !== "draft" && existing.status !== "needs_info")
      return { error: "not_draft" }

    const safeDraft = withoutModeratorKeys(
      draftData && typeof draftData === "object" ? draftData : {}
    )
    const rebaseRevision = safeDraft.rebaseRevision
    delete safeDraft.rebaseRevision
    if (rebaseRevision !== undefined) {
      if (
        typeof rebaseRevision !== "string" ||
        !/^[a-f0-9]{64}$/.test(rebaseRevision) ||
        !["wiki_edit", "blog_submission"].includes(existing.submissionType) ||
        isNewArticleDraft(existing.draftData)
      )
        return { error: "invalid", message: "Invalid article revision" }
      const current = await submissionArticle(
        strapi,
        existing,
        typeof safeDraft.locale === "string"
          ? safeDraft.locale
          : existing.contentLocale
      )
      if (!current || articleRevision(current) !== rebaseRevision)
        return {
          error: "invalid",
          message:
            "The article changed again. Reload the published version and compare before retrying.",
        }
      safeDraft.baseRevision = rebaseRevision
      safeDraft.sourceLocale = current.locale
    }
    // Also sync the top-level submission fields from draftData so the
    // moderation queue always reflects the latest wizard state.
    const { fields: libraryFields, extras } = splitSubmissionBody(safeDraft)
    const checked = validateSubmissionExtras(strapi, extras)
    if (!checked.ok) return { error: "invalid", message: checked.message }

    const updateData: Record<string, unknown> = {
      draftData: {
        ...safeDraft,
        ...(rebaseRevision
          ? { baseRevision: rebaseRevision }
          : existing.draftData?.baseRevision
            ? { baseRevision: existing.draftData.baseRevision }
            : {}),
        ...(staffCreationOf(existing.draftData)
          ? { staffCreation: staffCreationOf(existing.draftData) }
          : {}),
      },
      stepCompleted,
      fields: libraryFields,
      draftRevision: (existing.draftRevision ?? 0) + 1,
      ...checked.extras,
    }
    const priorStatus = existing.status
    if (priorStatus === "needs_info") {
      // Reopen privately before accepting edits, so a moderator cannot approve
      // a payload the contributor is still revising.
      updateData.status = "draft"
      updateData.payloadHash = null
    }
    // An article draft's language lives in `draftData.locale`; keep the
    // stored locale in step so `findDraft(…, locale)` finds it. Normalised
    // as create and finalize do.
    if (
      (existing.submissionType === "wiki_edit" ||
        existing.submissionType === "blog_submission") &&
      "locale" in safeDraft
    ) {
      const contentLocale = await resolveSubmissionLocale(strapi, undefined, {
        ...existing,
        draftData: safeDraft,
      })
      if (contentLocale !== existing.contentLocale)
        updateData.contentLocale = contentLocale
    }

    // Compare-and-set pinned to status *and* the exact draftRevision this
    // call read (see `revisionWhere`): status alone would let a concurrent
    // finalizeDraft's compare-and-set slip in between finalize's policy
    // check and its write while both still see status:"draft". `submission`
    // has draftAndPublish:false, so constraints.md allows this
    // strapi.db.query CAS in place of the plain documents().update.
    const count = await strapi.db.transaction(async () => {
      const result = await strapi.db
        .query("plugin::content-moderation.submission")
        .updateMany({
          where: {
            documentId,
            status: priorStatus,
            ...revisionWhere(existing),
          },
          data: updateData,
        })
      if (result.count === 1 && priorStatus === "needs_info")
        await writeReviewEvent(strapi, {
          submissionDocumentId: documentId,
          fromStatus: "needs_info",
          toStatus: "draft",
          reviewerId: `ba:${userId}`,
          reviewerKind: "contributor",
        })
      if (result.count === 1 && rebaseRevision)
        await writeReviewEvent(strapi, {
          submissionDocumentId: documentId,
          fromStatus: "draft",
          toStatus: "draft",
          reviewerId: `ba:${userId}`,
          reviewerKind: "contributor",
          note: "Writer explicitly compared and adopted the current published article revision.",
        })

      return result.count
    })
    if (count !== 1) return { error: "not_draft" }

    const data = await strapi
      .documents("plugin::content-moderation.submission")
      .findOne({ documentId })

    return { data: toContributor(await articleDraftMedia(strapi, data)) }
  },

  async finalizeDraft(
    documentId: string,
    userId: string,
    formData: Record<string, unknown>,
    // Runs against the same `existing` row this call is about to transition,
    // after the ownership/status checks below and before the CAS write —
    // so a policy check here can't be tricked by racing the check against a
    // stale or someone-else's row (C-1c / C-5).
    // `locale` is the one this finalize stores, so the check uses it too.
    beforeTransition?: (
      existing: any,
      next: { locale: string }
    ) => Promise<
      | { ok: true }
      | {
          ok: false
          status: number
          message: string
          details?: { errors: string[] }
        }
    >
  ): Promise<
    | null
    | {
        error: "policy"
        verdict: {
          ok: false
          status: number
          message: string
          details?: { errors: string[] }
        }
      }
    | Record<string, unknown>
  > {
    const existing = await strapi
      .documents("plugin::content-moderation.submission")
      .findOne({ documentId })

    if (!existing) return null
    if (existing.submittedByUserId !== userId) return null
    if (existing.status !== "draft" && existing.status !== "needs_info")
      return null

    // Snapshot the revision selector now, before `beforeTransition` runs:
    // the compare-and-set below must pin to what this call actually read at
    // the top, not to whatever `existing` might look like by the time we
    // reach the write (a concurrent saveDraft can land, and bump
    // draftRevision, while `beforeTransition` is still running).
    const casRevision = revisionWhere(existing)
    const priorStatus = existing.status

    // The body is the full form (the UI sends everything on finalize). A body
    // with no library fields keeps the saved draft's, so a bare finalize
    // can't blank a submission; the controller's content check uses the
    // same rule (see `splitSubmissionBody`).
    // `locale` picks the version the change is written to; it is not a
    // field of the change itself.
    const { locale: requestedLocale, ...form } = (
      formData && typeof formData === "object" ? formData : {}
    ) as Record<string, unknown>
    const {
      fields: libraryFields,
      extras,
      hasFields,
    } = splitSubmissionBody(form)
    const checked = validateSubmissionExtras(strapi, extras)
    if (!checked.ok)
      return {
        error: "policy",
        verdict: { ok: false, status: 400, message: checked.message },
      }

    const contentLocale = await resolveSubmissionLocale(
      strapi,
      requestedLocale,
      existing
    )

    if (beforeTransition) {
      const verdict = await beforeTransition(existing, {
        locale: contentLocale,
      })
      if (!verdict.ok) return { error: "policy", verdict }
    }

    const updateData: Record<string, unknown> = {
      status: "pending",
      fields: hasFields ? libraryFields : (existing.fields ?? {}),
      contentLocale,
    }
    // Drop contributor-supplied Moderator keys, keeping only the creation
    // intent already validated and stored by the authenticated controller.
    const creation = staffCreationOf(existing.draftData)
    const draftData = creation
      ? { ...withoutModeratorKeys(existing.draftData), staffCreation: creation }
      : withoutModeratorKeys(existing.draftData)
    if (draftData !== existing.draftData) updateData.draftData = draftData
    for (const [key, value] of Object.entries(checked.extras))
      if (value) updateData[key] = value

    // payloadHash must be computed from exactly what gets written, so it's
    // derived from `next` (existing + this updateData) before the CAS call.
    const next = { ...existing, ...updateData }
    updateData.payloadHash = payloadHash(next)

    // Compare-and-set pinned to status *and* the draftRevision snapshotted
    // above (see `revisionWhere`): a concurrent saveDraft that landed after
    // our read (bumping draftRevision) makes this match zero rows, even
    // though status is still "draft" on both sides. `submission` has
    // draftAndPublish:false, so constraints.md allows this strapi.db.query
    // CAS in place of the plain documents().update.
    // The Review Event (draft → pending, by the submitter) commits with it.
    const moved = await strapi.db.transaction(async () => {
      const { count } = await strapi.db
        .query("plugin::content-moderation.submission")
        .updateMany({
          where: { documentId, status: priorStatus, ...casRevision },
          data: updateData,
        })
      if (count !== 1) return false
      await writeReviewEvent(strapi, {
        submissionDocumentId: documentId,
        fromStatus: priorStatus,
        toStatus: "pending",
        reviewerId: `ba:${existing.submittedByUserId}`,
        reviewerKind: "contributor",
      })

      return true
    })
    if (!moved) return null

    const finalized = await strapi
      .documents("plugin::content-moderation.submission")
      .findOne({ documentId })
    if (finalized)
      scheduleNotification(strapi, `alert for ${documentId}`, () =>
        notifications(strapi).submissionPending(finalized)
      )

    // Same early release as `create`'s: the library is already in review,
    // this just frees the hold's 20 minutes sooner.
    if (
      finalized &&
      typeof finalized.driveDocumentId === "string" &&
      finalized.driveDocumentId &&
      typeof finalized.targetDocumentId === "string" &&
      finalized.targetDocumentId
    ) {
      try {
        await strapi
          .service("api::drive.drive")
          .releaseHold(finalized.driveDocumentId, finalized.targetDocumentId)
      } catch (err) {
        strapi.log.warn("[content-moderation] drive hold release failed:", err)
      }
    }

    return toContributor(finalized)
  },

  async findPublicByDocumentId(documentId: string) {
    // Private identity is an internal Query Engine lookup, never a public field selection.
    const profile = await strapi.db
      .query("api::user-profile.user-profile")
      .findOne({
        where: { documentId },
        select: ["baUserId", "profileVisibility", "publicPrefs"],
      })
    if (!profile?.baUserId || !isActivityPublic(profile)) return []

    return (this as any).findPublicByBaUserId(profile.baUserId)
  },

  async findPublicByBaUserId(baUserId: string) {
    // Approved only: what's still in review isn't public yet, and a
    // rejected one never was.
    const submissions = await strapi
      .documents("plugin::content-moderation.submission")
      .findMany({
        filters: {
          submittedByUserId: baUserId,
          status: { $eq: "approved" },
        },
        sort: { createdAt: "desc" },
        limit: 200,
      })

    const labelled = await withTargetLabels(strapi, submissions)

    return labelled.map((s: any) => ({
      documentId: s.documentId,
      submissionType: s.submissionType,
      status: s.status,
      targetEntityType: s.targetEntityType ?? null,
      targetSlug: s.targetSlug ?? null,
      targetLabel: s.targetLabel,
      editSummary: s.editSummary ?? null,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      reviewedAt: s.reviewedAt ?? null,
    }))
  },

  async findPublicByUsername(username: string) {
    const profile = await strapi.db
      .query("api::user-profile.user-profile")
      .findOne({
        where: { username },
        select: ["baUserId", "profileVisibility", "publicPrefs"],
      })
    if (!profile?.baUserId || !isActivityPublic(profile)) return []

    return (this as any).findPublicByBaUserId(profile.baUserId)
  },

  /** Records that `baUserId` uploaded `fileId` through the submission flow. */
  async recordUpload(fileId: number, baUserId: string) {
    // file_id is unique in the DB (I2 migration): a retried record by the
    // same uploader is a no-op rather than a unique-violation 500.
    const [existing] = (await strapi
      .documents("plugin::content-moderation.submission-upload" as any)
      .findMany({
        filters: { fileId: { $eq: fileId } } as any,
        limit: 1,
      })) as { baUserId: string }[]
    if (existing && existing.baUserId === baUserId) return existing

    return strapi
      .documents("plugin::content-moderation.submission-upload" as any)
      .create({ data: { fileId, baUserId } })
  },

  /**
   * How much `baUserId` has uploaded through the submission flow since UTC
   * midnight: the count of ownership rows, and their files' sizes in bytes
   * (`plugin::upload.file.size` is stored in kilobytes). A file that has
   * since been deleted counts as a file but no bytes.
   */
  async uploadUsage(
    baUserId: string
  ): Promise<{ files: number; bytes: number }> {
    const todayStart = `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`
    const rows = (await strapi
      .documents("plugin::content-moderation.submission-upload" as any)
      .findMany({
        filters: {
          baUserId: { $eq: baUserId },
          createdAt: { $gte: todayStart },
        } as any,
        fields: ["fileId"] as any,
        sort: { createdAt: "asc" } as any,
        // Well above any quota; a runaway user is capped, not loaded whole.
        limit: 1000,
      })) as { fileId?: number }[]
    const fileIds = [
      ...new Set(
        rows.map((r) => Number(r.fileId)).filter((id) => Number.isInteger(id))
      ),
    ]
    let bytes = 0
    if (fileIds.length > 0) {
      const files = (await strapi.documents("plugin::upload.file").findMany({
        filters: { id: { $in: fileIds } } as any,
        fields: ["id", "size"] as any,
        limit: fileIds.length,
      })) as { id: number; size?: number | string | null }[]
      for (const f of files) {
        const kb = Number(f.size ?? 0)
        if (Number.isFinite(kb) && kb > 0) bytes += Math.round(kb * 1000)
      }
    }

    return { files: rows.length, bytes }
  },

  /** A2: only files this submitter actually uploaded may be attached to their submission. */
  async ownedUploadIds(baUserId: string, ids: number[]): Promise<Set<number>> {
    return ownedUploadIds(strapi, baUserId, ids)
  },

  /**
   * The user's latest draft of this type (and target), in `locale`: an
   * English and a Czech draft of the same article are separate drafts.
   * Drafts written before submissions carried a locale count as the
   * default locale's.
   */
  async findDraft(
    userId: string,
    submissionType: string,
    targetSlug?: string,
    locale?: unknown,
    staffCreation = false
  ) {
    const wanted = await normaliseLocale(strapi, locale)
    const base = await defaultLocale(strapi)
    const filters: Record<string, unknown> = {
      submittedByUserId: userId,
      submissionType,
      status: { $in: ["draft", "needs_info"] },
      ...(wanted === base
        ? {
            $or: [
              { contentLocale: { $eq: wanted } },
              { contentLocale: { $null: true } },
            ],
          }
        : { contentLocale: { $eq: wanted } }),
    }
    if (targetSlug) filters.targetSlug = targetSlug
    const results = await strapi
      .documents("plugin::content-moderation.submission")
      .findMany({
        filters,
        sort: { updatedAt: "desc" },
        limit: submissionType === "new_library" ? 50 : 1,
      })

    const result =
      submissionType === "new_library"
        ? results.find(
            (row: any) => !!staffCreationOf(row.draftData) === staffCreation
          )
        : results[0]

    return toContributor(await articleDraftMedia(strapi, result ?? null))
  },

  /**
   * Sets (or, with no places, clears) the hierarchy a `new_library` is filed
   * under on approval, as `draftData.moderatorTarget`. Only while the
   * submission is in review. The stored payloadHash is re-pinned in the same
   * compare-and-set: the Moderator's change is part of what is reviewed,
   * never tampering. The caller checks the Moderator's scope and that each
   * id names a record.
   */
  async setModeratorTarget(
    documentId: string,
    target: ModeratorTarget
  ): Promise<
    | {
        error: "not_found" | "wrong_type" | "not_open" | "conflict" | "tampered"
      }
    | {
        data: {
          documentId: string
          moderatorTarget: ModeratorTarget | null
        }
      }
  > {
    const submission = await strapi
      .documents("plugin::content-moderation.submission")
      .findOne({ documentId })
    if (!submission || submission.status === "draft")
      return { error: "not_found" }
    if (!TARGETABLE_TYPES.has(submission.submissionType))
      return { error: "wrong_type" }
    if (submission.status !== "pending" && submission.status !== "needs_info")
      return { error: "not_open" }
    // Never re-pin a hash the stored content no longer matches: that would
    // launder a tampered payload into a reviewable one.
    if (
      submission.payloadHash &&
      submission.payloadHash !== payloadHash(submission)
    )
      return { error: "tampered" }

    const { moderatorTarget: _previous, ...rest } = asObject(
      submission.draftData
    )
    const draftData: Record<string, unknown> = { ...rest }
    const clean: ModeratorTarget = {}
    for (const k of HIERARCHY_KEYS)
      if (isDocumentId(target[k])) clean[k] = target[k]
    const hasTarget = Object.keys(clean).length > 0
    if (hasTarget) draftData.moderatorTarget = clean
    const next = { ...submission, draftData }

    const { count } = await strapi.db
      .query("plugin::content-moderation.submission")
      .updateMany({
        where: {
          documentId,
          status: submission.status,
          ...(submission.payloadHash
            ? { payloadHash: submission.payloadHash }
            : {}),
        },
        data: {
          draftData,
          // Re-pinned: draftData is hashed, and the Moderator's own change
          // must not make the approval read as `tampered`.
          ...(submission.payloadHash ? { payloadHash: payloadHash(next) } : {}),
        },
      })
    if (count !== 1) return { error: "conflict" }

    return {
      data: { documentId, moderatorTarget: hasTarget ? clean : null },
    }
  },

  /**
   * Sets the dates a `drive_proposal`'s drive is created with on approval,
   * as `draftData.moderatorEdit`. Only while the proposal is in review, and
   * only dates that make a valid drive with the rest of it (`invalid` lists
   * `validateDrive`'s errors). The stored payloadHash is re-pinned in the
   * same compare-and-set, as `setModeratorTarget` does: the Moderator's
   * change is part of what is reviewed, never tampering. The caller checks
   * the Moderator's scope.
   */
  async setModeratorEdit(
    documentId: string,
    edit: ModeratorEdit
  ): Promise<
    | {
        error: "not_found" | "wrong_type" | "not_open" | "conflict" | "tampered"
      }
    | { error: "invalid"; errors: string[] }
    | { data: { documentId: string; moderatorEdit: ModeratorEdit } }
  > {
    const submission = await strapi
      .documents("plugin::content-moderation.submission")
      .findOne({ documentId })
    if (!submission || submission.status === "draft")
      return { error: "not_found" }
    if (submission.submissionType !== "drive_proposal")
      return { error: "wrong_type" }
    if (submission.status !== "pending" && submission.status !== "needs_info")
      return { error: "not_open" }
    // Never re-pin a hash the stored content no longer matches.
    if (
      submission.payloadHash &&
      submission.payloadHash !== payloadHash(submission)
    )
      return { error: "tampered" }

    const moderatorEdit: ModeratorEdit = {
      startsAt: edit.startsAt,
      endsAt: edit.endsAt,
    }
    const draftData: Record<string, unknown> = {
      ...asObject(submission.draftData),
      moderatorEdit,
    }
    const drive = proposedDrive(draftData, { withModeratorEdit: true })
    const errors = drive
      ? validateDrive(drive, new Date())
      : ["Describe the drive you’re proposing."]
    if (errors.length > 0) return { error: "invalid", errors }
    const next = { ...submission, draftData }

    const { count } = await strapi.db
      .query("plugin::content-moderation.submission")
      .updateMany({
        where: {
          documentId,
          status: submission.status,
          ...(submission.payloadHash
            ? { payloadHash: submission.payloadHash }
            : {}),
        },
        data: {
          draftData,
          // Re-pinned: draftData is hashed, and the Moderator's own change
          // must not make the approval read as `tampered`.
          ...(submission.payloadHash ? { payloadHash: payloadHash(next) } : {}),
        },
      })
    if (count !== 1) return { error: "conflict" }

    return { data: { documentId, moderatorEdit } }
  },

  /** Applies an approved facilities correction (see utils/facility-answers). */
  async applyFacilityAnswers(submission: any): Promise<ApplyRecordOutcome> {
    return applyFacilityAnswers(strapi, submission)
  },

  /**
   * Applies an approved library_edit or record correction (see
   * utils/library-record); `report` receives the fields it changed.
   */
  async applyLibraryRecord(
    submission: any,
    report?: RecordChangeReport
  ): Promise<ApplyRecordOutcome> {
    const f = (submission.fields ?? {}) as Record<string, unknown>
    const claimed = Array.isArray(f.uploadedImages)
      ? (f.uploadedImages as { strapiId?: unknown }[])
      : []
    // A2: only files this submitter uploaded through the submission flow.
    const owned = await (this as any).ownedUploadIds(
      submission.submittedByUserId,
      claimed.map((i) => Number(i.strapiId)).filter(Number.isInteger)
    )

    return applyLibraryRecord(strapi, submission, owned, report)
  },

  /** Adds an approved photo to the library (see utils/library-photo). */
  async applyLibraryPhoto(submission: any): Promise<ApplyRecordOutcome> {
    const id = photoIdOf(submission.fields)
    // A2: only a file this submitter uploaded through the submission flow.
    const owned: Set<number> = id
      ? await (this as any).ownedUploadIds(submission.submittedByUserId, [id])
      : new Set()

    return applyLibraryPhoto(strapi, submission, owned)
  },

  /** Applies an approved Knowledge submission (see utils/article-apply). */
  async applyWikiEdit(submission: any): Promise<ApplyArticleOutcome> {
    return applyArticleSubmission(strapi, submission, "wiki")
  },

  /** Applies an approved Journal submission (see utils/article-apply). */
  async applyJournalSubmission(submission: any): Promise<ApplyArticleOutcome> {
    return applyArticleSubmission(strapi, submission, "journal")
  },

  /**
   * Applies an approved Knowledge or Journal submission and reports the
   * article it created, if any (see utils/article-apply).
   */
  async applyArticle(
    submission: any,
    kind: "wiki" | "journal",
    opts: { publish?: boolean } = {}
  ): Promise<ApplyArticleResult> {
    return applyArticleSubmissionWithResult(strapi, submission, kind, opts)
  },
})
