import {
  type ApiAccountInput,
  type Entitlements,
  resolveEntitlements,
} from "@repo/access"

import { loadApiAccounts } from "./api-accounts"
import { loadTeamMemberships } from "./team-access"

const PROFILE = "api::user-profile.user-profile"

export type EntitlementInputs = {
  acceptedContributions: number
  recognitionRevoked: boolean
  apiAccounts: ApiAccountInput[]
}

/**
 * Everything `resolveEntitlements` needs for one user, read from the same
 * rows the session bridge sends the site: accepted-contribution recognition
 * and the API accounts of the organisations they belong to.
 */
export async function loadEntitlementInputs(
  strapi: any,
  baUserId: string
): Promise<EntitlementInputs> {
  const [profile, memberships] = await Promise.all([
    // `recognitionRevokedAt` is private: the Document Service refuses to
    // select it explicitly, so this one-row read uses the query engine.
    strapi.db.query(PROFILE).findOne({
      where: { baUserId: { $eq: baUserId } },
      select: ["acceptedContributions", "recognitionRevokedAt"],
    }) as Promise<{
      acceptedContributions?: number | null
      recognitionRevokedAt?: string | null
    } | null>,
    loadTeamMemberships(strapi, baUserId),
  ])

  return {
    acceptedContributions: profile?.acceptedContributions ?? 0,
    recognitionRevoked: profile?.recognitionRevokedAt != null,
    apiAccounts: await loadApiAccounts(strapi, memberships),
  }
}

/**
 * The user's Entitlements, resolved in Strapi exactly as the session does
 * (`buildSessionAccess`). For gating data Strapi serves, so the site's
 * session is never the only check. Entitlements never carry staff authority.
 */
export async function resolveUserEntitlements(
  strapi: any,
  baUserId: string,
  now: Date = new Date()
): Promise<Entitlements> {
  const inputs = await loadEntitlementInputs(strapi, baUserId)

  return resolveEntitlements({ signedIn: true, now, ...inputs })
}
