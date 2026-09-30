import {
  canSubmit,
  type Capabilities,
  contributionLimits,
  grantsFromLegacyRole,
  isContributorRole,
  isSubmissionType,
  resolveCapabilities,
  SESSION_PROFILE_MAX_CLAIMS,
} from "@repo/access"
import { findUnsafeContent } from "@repo/shared-data"

import { isDocumentId, VERIFICATION_METHODS } from "../utils/params"

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

export default ({ strapi }: { strapi: any }) => ({
  /**
   * Loads the submitter's contributor role, tier and library claims, and
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
        fields: ["contributorRole", "tier"],
        limit: 1,
      })) as { contributorRole?: string; tier?: string }[]

    const affiliations = (await strapi
      .documents("api::library-affiliation.library-affiliation")
      .findMany({
        filters: { baUserId: { $eq: baUserId }, ...CLAIM_AFFILIATION_FILTER },
        populate: { library: { fields: ["documentId"] } },
        limit: SESSION_PROFILE_MAX_CLAIMS,
      })) as { library?: { documentId?: string } }[]

    const caps = resolveCapabilities({
      signedIn: true,
      grants: grantsFromLegacyRole(
        isContributorRole(profile?.contributorRole)
          ? profile!.contributorRole
          : "reader"
      ),
      claims: affiliations
        .map((a) => a.library?.documentId)
        .filter((id): id is string => !!id)
        .map((libraryDocumentId) => ({ libraryDocumentId })),
    })

    return {
      caps,
      tier: profile?.tier ?? null,
      role: profile?.contributorRole ?? null,
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
    targetDocumentId?: unknown
    directWikiEdit?: boolean
    directJournalEdit?: boolean
    verificationMethod?: unknown
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

    const { caps, tier, role } = await (this as any).loadCapabilities(baUserId)

    if (
      !canSubmit(caps, submissionType, {
        libraryDocumentId:
          typeof input.targetDocumentId === "string"
            ? input.targetDocumentId
            : undefined,
        directWikiEdit: !!input.directWikiEdit,
        directJournalEdit: !!input.directJournalEdit,
      })
    )
      return {
        ok: false,
        status: 403,
        message: "You can't submit this type of change.",
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
