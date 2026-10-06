import {
  canSubmit,
  type Capabilities,
  contributionLimits,
  highestRole,
  isSubmissionType,
  resolveCapabilities,
  ROLE_APPLICATION_COOLDOWN_DAYS,
  ROLE_APPLICATION_MIN_ACCEPTED,
  type RoleGrant,
  SESSION_PROFILE_MAX_CLAIMS,
} from "@repo/access"
import {
  findUnsafeContent,
  focusMatches,
  libraryInScope,
} from "@repo/shared-data"

import { loadDriveLibrary } from "../../../../utils/drive-library"
import { activeGrants } from "../../../../utils/role-grants"
import { isHttpUrl } from "../utils/library-record"
import { isVerification, verifySections } from "../utils/library-verify"
import { configuredLocales } from "../utils/locales"
import {
  applicationSectionKind,
  isDocumentId,
  type RoleApplicationFields,
  validateRoleApplicationFields,
  VERIFICATION_METHODS,
} from "../utils/params"

type Result =
  | { ok: true }
  | { ok: false; status: 400 | 403 | 429; message: string }

/** The contributor-written parts of a submission. */
export type SubmissionContent = {
  fields?: unknown
  draftData?: unknown
  note?: unknown
  editSummary?: unknown
  evidenceUrl?: unknown
}

const LIBRARY = "api::library.library"
const SUBMISSION = "plugin::content-moderation.submission"
const DRIVE = "api::drive.drive"
/** Submission types a Drive tag may ride on (library changes only). */
const DRIVE_SUBMISSION_TYPES = new Set(["correction", "library_edit"])
const SECTION_UID = {
  wiki: "api::wiki-section.wiki-section",
  blog: "api::blog-section.blog-section",
} as const
/** Most open applications read when looking for one for the same role. */
const OPEN_APPLICATIONS_MAX = 50
const DAY_MS = 24 * 60 * 60 * 1000

/** "3 November 2026": the date format the application messages use. */
const longDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

/**
 * Whether the user's grants already cover the application. An
 * `editorial_board` grant covers every application. Otherwise only grants
 * for the role count (for a Moderator, in the queue applied for or in every
 * queue): one with no locale covers every locale; else every requested
 * locale must be granted, and an application for all locales is covered
 * only by an all-locale grant.
 */
export function grantsCover(
  grants: readonly RoleGrant[],
  application: Pick<RoleApplicationFields, "role" | "queue" | "locales">
): boolean {
  if (grants.some((g) => g.role === "editorial_board")) return true
  const held = grants.filter(
    (g) =>
      g.role === application.role &&
      (application.role !== "moderator" ||
        g.queue === "all" ||
        g.queue === application.queue)
  )
  if (held.some((g) => g.locale === null)) return true
  if (application.locales.length === 0) return false
  const locales = new Set(held.map((g) => g.locale))

  return application.locales.every((l) => locales.has(l))
}

/**
 * Affiliation roles that are not Library Claims. A `new_library` approval
 * records the submitter as `proposer` (D-C5): they proposed the record, they
 * don't work there, so it grants no `submit.libraryEdit` or `events.feed`.
 * (`src/utils/affiliations.ts` keeps its own copy for the session bridge.)
 */
const NON_CLAIM_AFFILIATION_ROLES = ["proposer"] as const

/**
 * The affiliation filter for claims only. `$ne`/`$notIn` alone would also
 * drop rows whose `role` is NULL (SQL three-valued logic), and a claim may
 * carry no role at all, so nulls are matched explicitly.
 */
export const CLAIM_AFFILIATION_FILTER = {
  $or: [
    { role: { $null: true } },
    { role: { $notIn: [...NON_CLAIM_AFFILIATION_ROLES] } },
  ],
}

/**
 * How many of the user's submissions were accepted (`approved`), not
 * counting Role Applications: the number the Role Application eligibility
 * rule reads. Counted in the database.
 */
export async function acceptedCount(
  strapi: any,
  baUserId: string
): Promise<number> {
  const n = await strapi.documents(SUBMISSION).count({
    filters: {
      submittedByUserId: { $eq: baUserId },
      status: { $eq: "approved" },
      submissionType: { $ne: "role_application" },
    },
  })

  return Number(n ?? 0)
}

/**
 * The date the user may apply for `role` again, when an application of
 * theirs for it was rejected less than `ROLE_APPLICATION_COOLDOWN_DAYS`
 * ago; otherwise null.
 */
export async function reapplyDate(
  strapi: any,
  baUserId: string,
  role: string,
  now: Date = new Date()
): Promise<Date | null> {
  const cutoff = new Date(
    now.getTime() - ROLE_APPLICATION_COOLDOWN_DAYS * DAY_MS
  )
  const rejected = (await strapi.documents(SUBMISSION).findMany({
    filters: {
      submittedByUserId: { $eq: baUserId },
      submissionType: { $eq: "role_application" },
      status: { $eq: "rejected" },
      reviewedAt: { $gte: cutoff.toISOString() },
    },
    fields: ["documentId", "fields", "reviewedAt"],
    sort: [{ reviewedAt: "desc" }, { id: "desc" }],
    limit: OPEN_APPLICATIONS_MAX,
  })) as { fields?: { role?: unknown } | null; reviewedAt?: string | null }[]
  const last = rejected.find(
    (row) => row.fields?.role === role && !!row.reviewedAt
  )
  if (!last?.reviewedAt) return null
  const decided = new Date(last.reviewedAt)
  if (Number.isNaN(decided.getTime())) return null

  return new Date(decided.getTime() + ROLE_APPLICATION_COOLDOWN_DAYS * DAY_MS)
}

/** Whether every section slug exists in the list the application names. */
async function sectionsExist(
  strapi: any,
  application: RoleApplicationFields
): Promise<boolean> {
  const kind = applicationSectionKind(application)
  if (!kind || application.sections.length === 0) return true
  const found = (await strapi.documents(SECTION_UID[kind] as any).findMany({
    filters: { slug: { $in: application.sections } },
    fields: ["slug"],
    limit: application.sections.length,
  })) as { slug?: string }[]
  const slugs = new Set(found.map((r) => r.slug))

  return application.sections.every((slug) => slugs.has(slug))
}

/**
 * Role Application eligibility (spec §6.1): valid fields, at least
 * `ROLE_APPLICATION_MIN_ACCEPTED` approved submissions that aren't
 * applications, no open application for the same role, no grant that
 * already covers it, and no rejection for the same role in the last
 * `ROLE_APPLICATION_COOLDOWN_DAYS`. Never reads Plan, Tier or Points.
 * `targetEntityType` is not checked: `create` files every application
 * against the user's profile.
 */
async function checkRoleApplication(
  strapi: any,
  input: { baUserId: string; fields: unknown; excludeDocumentId?: string }
): Promise<Result> {
  const parsed = validateRoleApplicationFields(
    input.fields,
    await configuredLocales(strapi)
  )
  if (!parsed.ok) return { ok: false, status: 400, message: parsed.message }
  const application = parsed.value
  if (!(await sectionsExist(strapi, application)))
    return { ok: false, status: 400, message: "Choose sections from the list." }

  const accepted = await acceptedCount(strapi, input.baUserId)
  if (accepted < ROLE_APPLICATION_MIN_ACCEPTED)
    return {
      ok: false,
      status: 403,
      message: `Editor and moderator roles go to people with at least ${ROLE_APPLICATION_MIN_ACCEPTED} accepted changes.`,
    }

  const open = (await strapi.documents(SUBMISSION).findMany({
    filters: {
      submittedByUserId: { $eq: input.baUserId },
      submissionType: { $eq: "role_application" },
      status: { $in: ["draft", "pending", "needs_info"] },
      ...(input.excludeDocumentId
        ? { documentId: { $ne: input.excludeDocumentId } }
        : {}),
    },
    fields: ["documentId", "fields"],
    sort: "createdAt:desc",
    limit: OPEN_APPLICATIONS_MAX,
  })) as { fields?: { role?: unknown } | null }[]
  if (open.some((row) => row.fields?.role === application.role))
    return {
      ok: false,
      status: 403,
      message: "You already have an application for this role.",
    }

  if (grantsCover(await activeGrants(strapi, input.baUserId), application))
    return { ok: false, status: 403, message: "You already have this role." }

  const again = await reapplyDate(strapi, input.baUserId, application.role)
  if (again)
    return {
      ok: false,
      status: 403,
      message: `You can apply for this role again on ${longDate.format(again)}.`,
    }

  return { ok: true }
}

export default ({ strapi }: { strapi: any }) => ({
  /**
   * Loads the submitter's Role Grants, tier and library claims, and
   * resolves them into `Capabilities`. Shared by `check()` (create/finalize
   * time) and `applyWikiEdit` (apply time) so the same rule governs both —
   * a role or claim that changed (or was never valid) between submission
   * and approval is re-checked at apply time, not trusted from the past.
   */
  async loadCapabilities(baUserId: string): Promise<{
    caps: Capabilities
    tier: string | null
    role: string | null
  }> {
    const [profile] = (await strapi
      .documents("api::user-profile.user-profile")
      .findMany({
        filters: { baUserId: { $eq: baUserId } },
        fields: ["tier"],
        limit: 1,
      })) as { tier?: string }[]

    const affiliations = (await strapi
      .documents("api::library-affiliation.library-affiliation")
      .findMany({
        filters: { baUserId: { $eq: baUserId }, ...CLAIM_AFFILIATION_FILTER },
        populate: { library: { fields: ["documentId"] } },
        limit: SESSION_PROFILE_MAX_CLAIMS,
      })) as { library?: { documentId?: string } }[]

    // Role Grants are the source of truth; `contributorRole` on the profile
    // is only their derived display value.
    const grants = await activeGrants(strapi, baUserId)

    const caps = resolveCapabilities({
      signedIn: true,
      grants,
      claims: affiliations
        .map((a) => a.library?.documentId)
        .filter((id): id is string => !!id)
        .map((libraryDocumentId) => ({ libraryDocumentId })),
    })

    return {
      caps,
      tier: profile?.tier ?? null,
      role: highestRole(grants),
    }
  },

  /**
   * Refuses offensive language and unsafe links anywhere in what the
   * contributor wrote. Words from the target library's own name and address
   * are allowed, so a real place is never mistaken for a swear.
   */
  async checkContent(
    content: SubmissionContent,
    target: { targetDocumentId?: unknown; targetSlug?: unknown } = {}
  ): Promise<Result> {
    const allow = await (this as any).allowedTerms(target)
    const issue = findUnsafeContent(content, allow)
    if (!issue) return { ok: true }
    strapi.log.info(
      `[content-moderation] refused a submission: unsafe content at ${issue.path}`
    )

    return { ok: false, status: 400, message: issue.message }
  },

  /** The target library's name and address, as terms the checker allows. */
  async allowedTerms(target: {
    targetDocumentId?: unknown
    targetSlug?: unknown
  }): Promise<string[]> {
    const fields = ["name", "shortName", "streetAddress", "district", "city"]
    let library: Record<string, unknown> | null = null
    try {
      if (isDocumentId(target.targetDocumentId))
        library = await strapi
          .documents(LIBRARY)
          .findOne({ documentId: target.targetDocumentId, fields })
      else if (typeof target.targetSlug === "string" && target.targetSlug)
        [library] = await strapi.documents(LIBRARY).findMany({
          filters: { slug: { $eq: target.targetSlug } },
          fields,
          limit: 1,
        })
    } catch {
      library = null
    }

    return library
      ? fields
          .map((f) => library![f])
          .filter((v): v is string => typeof v === "string" && !!v.trim())
      : []
  },

  async check(input: {
    baUserId: string
    submissionType: unknown
    /** The submission's `fields`; required for a `role_application`. */
    fields?: unknown
    targetEntityType?: unknown
    targetDocumentId?: unknown
    targetSlug?: unknown
    directWikiEdit?: boolean
    directJournalEdit?: boolean
    verificationMethod?: unknown
    /** The submission's evidence; a verify correction needs some. */
    evidenceType?: unknown
    evidenceUrl?: unknown
    /**
     * The submission's normalised locale. Direct edits are checked against
     * the editor's locales in it; without one, any direct-edit right counts.
     */
    locale?: string
    /** The Drive this change claims to fill a gap for, if any. */
    driveDocumentId?: unknown
    // Finalize re-checks the quota against the same row that's about to be
    // promoted out of `draft`; excluding it here avoids counting it against
    // itself (it isn't `pending`/`needs_info` yet, but the hourly count
    // would otherwise double-count it once finalize is itself a retry).
    excludeDocumentId?: string
  }): Promise<Result> {
    const { baUserId, submissionType } = input
    if (!isSubmissionType(submissionType))
      return { ok: false, status: 400, message: "Unknown submission type" }
    if (input.targetDocumentId != null && !isDocumentId(input.targetDocumentId))
      return { ok: false, status: 400, message: "Invalid target" }
    if (
      input.verificationMethod != null &&
      !(VERIFICATION_METHODS as readonly string[]).includes(
        String(input.verificationMethod)
      )
    )
      return { ok: false, status: 400, message: "Invalid verification method" }
    if (input.driveDocumentId != null) {
      if (!isDocumentId(input.driveDocumentId))
        return { ok: false, status: 400, message: "Invalid drive" }
      if (!DRIVE_SUBMISSION_TYPES.has(submissionType))
        return {
          ok: false,
          status: 400,
          message: "Only library changes can join a drive.",
        }
    }

    const { caps, tier, role } = await (this as any).loadCapabilities(baUserId)

    if (
      !canSubmit(caps, submissionType, {
        libraryDocumentId:
          typeof input.targetDocumentId === "string"
            ? input.targetDocumentId
            : undefined,
        directWikiEdit: !!input.directWikiEdit,
        directJournalEdit: !!input.directJournalEdit,
        ...(typeof input.locale === "string" ? { locale: input.locale } : {}),
      })
    )
      return {
        ok: false,
        status: 403,
        message: "You can't submit this type of change.",
      }

    if (typeof input.driveDocumentId === "string") {
      const drive = await strapi.documents(DRIVE).findOne({
        documentId: input.driveDocumentId,
        fields: ["documentId", "status", "scope", "focus", "openedAt"],
      })
      if (!drive || drive.status !== "open")
        return { ok: false, status: 422, message: "This drive isn’t open." }

      const library = await loadDriveLibrary(strapi, {
        targetDocumentId: input.targetDocumentId,
        targetSlug: input.targetSlug,
      })
      if (!library || !libraryInScope(library, drive.scope, drive.openedAt))
        return {
          ok: false,
          status: 422,
          message: "This library isn’t part of the drive.",
        }

      if (
        !focusMatches(drive.focus, {
          submissionType,
          fields: input.fields,
        })
      )
        return {
          ok: false,
          status: 422,
          message: "This change doesn’t fill the drive’s gap.",
        }
    }

    if (submissionType === "role_application") {
      const eligible = await checkRoleApplication(strapi, {
        baUserId,
        fields: input.fields,
        excludeDocumentId: input.excludeDocumentId,
      })
      if (!eligible.ok) return eligible
    }

    // "Still right?": a verify confirms at least one section, and says how
    // it was checked: the page looked at, or a visit in person.
    if (submissionType === "correction" && isVerification(input.fields)) {
      if (verifySections(input.fields).length === 0)
        return {
          ok: false,
          status: 400,
          message: "Choose at least one section to confirm.",
        }
      const hasTarget =
        (typeof input.targetDocumentId === "string" &&
          input.targetDocumentId.trim() !== "") ||
        (typeof input.targetSlug === "string" && input.targetSlug.trim() !== "")
      if (!hasTarget)
        return {
          ok: false,
          status: 400,
          message: "Choose the library you checked.",
        }
      if (
        !isHttpUrl(input.evidenceUrl) &&
        input.evidenceType !== "on_site_visit"
      )
        return {
          ok: false,
          status: 400,
          message: "Add the page you checked, or say you checked in person.",
        }
    }

    const limits = contributionLimits(tier, role)
    const excludeFilter = input.excludeDocumentId
      ? { documentId: { $ne: input.excludeDocumentId } }
      : {}

    const pending = await strapi
      .documents("plugin::content-moderation.submission")
      .count({
        filters: {
          submittedByUserId: { $eq: baUserId },
          status: { $in: ["pending", "needs_info"] },
          ...excludeFilter,
        },
      })
    if (pending >= limits.pendingSubmissions)
      return {
        ok: false,
        status: 429,
        message: `You have ${pending} submissions in review. Wait for some to be reviewed before adding more.`,
      }

    const hourAgo = new Date(Date.now() - 3_600_000).toISOString()
    const lastHour = await strapi
      .documents("plugin::content-moderation.submission")
      .count({
        filters: {
          submittedByUserId: { $eq: baUserId },
          createdAt: { $gte: hourAgo },
          ...excludeFilter,
        },
      })
    if (lastHour >= limits.submissionsPerHour)
      return {
        ok: false,
        status: 429,
        message: "Too many submissions this hour. Try again later.",
      }

    return { ok: true }
  },
})
