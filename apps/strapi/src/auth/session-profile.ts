import { SESSION_PROFILE_MAX_CLAIMS } from "@repo/access"
import { libraryTypeName, isDismissiblePrompt } from "@repo/shared-data"
import type { Core } from "@strapi/strapi"

import { claimAffiliationFilter } from "../utils/affiliations"
import { loadApiAccounts } from "../utils/api-accounts"
import { internalNotifications } from "../utils/internal-notifications/service"
import { activeGrants } from "../utils/role-grants"
import { loadStaffClaims } from "../utils/staff"

type StaffLibrary = {
  documentId: string
  name?: string
  slug?: string
  libraryType?: { name?: string }
}

export async function sessionProfile(strapi: Core.Strapi, baUserId: string) {
  const [[profile], affiliations, roleGrants, recognition] = await Promise.all([
    strapi.documents("api::user-profile.user-profile").findMany({
      filters: { baUserId: { $eq: baUserId } },
      fields: [
        "contributorRole",
        "username",
        "tier",
        "points",
        "acceptedContributions",
        "lastContributionAt",
        "dismissedPrompts",
        "country",
      ],
      populate: { languages: { fields: ["code", "proficiency"] } },
      limit: 1,
    }) as Promise<
      {
        contributorRole?: string
        username?: string
        tier?: string
        points?: number
        acceptedContributions?: number | null
        lastContributionAt?: string | null
        dismissedPrompts?: unknown
        country?: string | null
        languages?: { code: string; proficiency: string }[]
      }[]
    >,
    strapi.documents("api::library-affiliation.library-affiliation").findMany({
      filters: claimAffiliationFilter(baUserId),
      populate: { library: { fields: ["documentId"] } },
      limit: SESSION_PROFILE_MAX_CLAIMS,
    }) as Promise<{ library?: { documentId?: string } }[]>,
    // Unexpired Role Grants, at most MAX_ACTIVE_GRANTS.
    activeGrants(strapi, baUserId),
    // Moderator revocation is private; the session carries only a boolean.
    strapi.db.query("api::user-profile.user-profile").findOne({
      where: { baUserId: { $eq: baUserId } },
      select: ["recognitionRevokedAt"],
    }) as Promise<{ recognitionRevokedAt?: string | null } | null>,
  ])

  if (profile && process.env.INTERNAL_NOTIFICATIONS_ENABLED === "true") {
    try {
      await internalNotifications(strapi).active(baUserId)
    } catch {
      strapi.log.warn("[internal-notifications] Could not record beta activity")
    }
  }

  // Free staff workspaces the user belongs to. Membership never grants
  // library authority; it only locates the user's API accounts.
  const teams: {
    id: string
    name: string
    slug: string
    role: "organiser" | "member"
    libraryCount: number
    libraryDocumentIds: string[]
    organiserName: string | null
  }[] =
    (await strapi
      .plugin("access")
      ?.service("teams")
      ?.listMine(baUserId)
      .catch((err: unknown) => {
        strapi.log.warn("[auth-bridge] teams lookup failed", err)

        return []
      })) ?? []

  // API accounts from each organisation's Team API paid projection.
  const apiAccounts = await loadApiAccounts(
    strapi,
    teams.map((t) => ({ teamDocumentId: t.id, teamRole: t.role }))
  )

  // Staff memberships, then one query for their libraries' names.
  const staffClaims = await loadStaffClaims(strapi, baUserId)
  const staffLibraries = new Map<string, StaffLibrary>(
    staffClaims.length
      ? (
          (await strapi.documents("api::library.library").findMany({
            populate: { libraryType: { fields: ["name"] } },
            filters: {
              documentId: {
                $in: staffClaims.map((claim) => claim.libraryDocumentId),
              },
            },
            status: "published",
            fields: ["documentId", "name", "slug"],
            limit: staffClaims.length,
          })) as StaffLibrary[]
        ).map((library) => [library.documentId, library])
      : []
  )

  return {
    contributorRole: profile?.contributorRole ?? "reader",
    staff: staffClaims.flatMap((claim) => {
      const library = staffLibraries.get(claim.libraryDocumentId)

      return library
        ? [
            {
              ...claim,
              name: library.name ?? "Library",
              slug: library.slug ?? "",
              libraryType: libraryTypeName(library.libraryType) ?? "",
            },
          ]
        : []
    }),
    username: profile?.username ?? null,
    country: profile?.country ?? null,
    languages: (profile?.languages ?? []).map(({ code, proficiency }) => ({
      code,
      proficiency,
    })),
    tier: profile?.tier ?? null,
    claims: affiliations
      .map((a) => a.library?.documentId)
      .filter((id): id is string => !!id),
    roleGrants,
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      role: t.role,
      libraryCount: t.libraryCount,
      libraryDocumentIds: t.libraryDocumentIds,
      organiserName: t.organiserName,
    })),
    apiAccounts,
    rewardsPoints: profile?.points ?? 0,
    acceptedContributions: Math.max(0, profile?.acceptedContributions ?? 0),
    lastContributionAt: profile?.lastContributionAt ?? null,
    recognitionRevoked: recognition?.recognitionRevokedAt != null,
    dismissedPrompts: Array.isArray(profile?.dismissedPrompts)
      ? profile.dismissedPrompts.filter(isDismissiblePrompt)
      : [],
  }
}
