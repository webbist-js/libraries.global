import {
  canSubmit,
  type Capabilities,
  contributionLimits,
  isContributorRole,
  isSubmissionType,
  resolveCapabilities,
} from "@repo/access"

import { isDocumentId, VERIFICATION_METHODS } from "../utils/params"

type Result =
  | { ok: true }
  | { ok: false; status: 400 | 403 | 429; message: string }

export default ({ strapi }: { strapi: any }) => ({
  /**
   * Loads the submitter's contributor role, tier and library claims, and
   * resolves them into `Capabilities`. Shared by `check()` (create/finalize
   * time) and `applyWikiEdit` (apply time) so the same rule governs both —
   * a role or claim that changed (or was never valid) between submission
   * and approval is re-checked at apply time, not trusted from the past.
   */
  async loadCapabilities(
    baUserId: string
  ): Promise<{ caps: Capabilities; tier: string | null }> {
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
        filters: { baUserId: { $eq: baUserId } },
        populate: { library: { fields: ["documentId"] } },
        limit: 100,
      })) as { library?: { documentId?: string } }[]

    const caps = resolveCapabilities({
      signedIn: true,
      contributorRole: isContributorRole(profile?.contributorRole)
        ? (profile!.contributorRole as any)
        : "reader",
      claims: affiliations
        .map((a) => a.library?.documentId)
        .filter((id): id is string => !!id)
        .map((libraryDocumentId) => ({ libraryDocumentId })),
    })

    return { caps, tier: profile?.tier ?? null }
  },

  async check(input: {
    baUserId: string
    submissionType: unknown
    targetDocumentId?: unknown
    directWikiEdit?: boolean
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

    const { caps, tier } = await (this as any).loadCapabilities(baUserId)

    if (
      !canSubmit(caps, submissionType, {
        libraryDocumentId:
          typeof input.targetDocumentId === "string"
            ? input.targetDocumentId
            : undefined,
        directWikiEdit: !!input.directWikiEdit,
      })
    )
      return {
        ok: false,
        status: 403,
        message: "You can't submit this type of change.",
      }

    const limits = contributionLimits(tier)
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
