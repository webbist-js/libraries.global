import { SESSION_PROFILE_MAX_CLAIMS } from "@repo/access"
import { libraryTypeName, isDismissiblePrompt } from "@repo/shared-data"
import type { Core } from "@strapi/strapi"

import { claimAffiliationFilter } from "../utils/affiliations"
import { loadPlanRows } from "../utils/entitlement-inputs"
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
  const [[profile], affiliations, planRows, roleGrants] = await Promise.all([
    strapi.documents("api::user-profile.user-profile").findMany({
      filters: { baUserId: { $eq: baUserId } },
      fields: [
        "contributorRole",
        "username",
        "tier",
        "earnedProUntil",
        "points",
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
        earnedProUntil?: string | null
        points?: number
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
    // Unexpired plan grants and Pro verifications (shared with the
    // Strapi-side entitlement checks, utils/entitlement-inputs).
    loadPlanRows(strapi, baUserId),
    // Unexpired Role Grants, at most MAX_ACTIVE_GRANTS. `grants` above
    // are plan grants; the two never mix.
    activeGrants(strapi, baUserId),
  ])

  if (profile && process.env.INTERNAL_NOTIFICATIONS_ENABLED === "true") {
    try {
      await internalNotifications(strapi).active(baUserId)
    } catch {
      strapi.log.warn("[internal-notifications] Could not record beta activity")
    }
  }

  // Teams (R2-B): active memberships, with each Team's libraries, so the
  // session resolves Pro (source `team`) and `teamLibraryIds` itself.
  const teams: {
    id: string
    name: string
    slug: string
    role: "organiser" | "member"
    libraryCount: number
    libraryDocumentIds: string[]
    expiresAt: string | null
    status: "active" | "lapsed"
    organiserName: string | null
    selfService?: boolean
  }[] =
    (await strapi
      .plugin("access")
      ?.service("teams")
      ?.listMine(baUserId)
      .catch((err: unknown) => {
        strapi.log.warn("[auth-bridge] teams lookup failed", err)

        return []
      })) ?? []

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
    grants: planRows.grants,
    ...(planRows.paidMembership
      ? { paidMembership: planRows.paidMembership }
      : {}),
    roleGrants,
    verifications: planRows.verifications,
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      role: t.role,
      libraryCount: t.libraryCount,
      ...(t.selfService ? { selfService: true } : {}),
      libraryDocumentIds: t.libraryDocumentIds,
      expiresAt: t.expiresAt,
      status: t.status,
      organiserName: t.organiserName,
    })),
    earnedProUntil: profile?.earnedProUntil ?? null,
    rewardsPoints: profile?.points ?? 0,
    dismissedPrompts: Array.isArray(profile?.dismissedPrompts)
      ? profile.dismissedPrompts.filter(isDismissiblePrompt)
      : [],
  }
}
