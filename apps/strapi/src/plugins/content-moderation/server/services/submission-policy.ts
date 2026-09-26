import {
  canSubmit,
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
  async check(input: {
    baUserId: string
    submissionType: unknown
    targetDocumentId?: unknown
    directWikiEdit?: boolean
    verificationMethod?: unknown
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

    const limits = contributionLimits(profile?.tier ?? null)
    const pending = await strapi
      .documents("plugin::content-moderation.submission")
      .count({
        filters: {
          submittedByUserId: { $eq: baUserId },
          status: { $in: ["pending", "needs_info"] },
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
