import {
  apiAccountsOf,
  sessionTeamsOf,
  staffLibrariesOf,
} from "@/lib/access-server"

import type { MembershipDashboardProps } from "./MembershipDashboard"

const count = (value: unknown) =>
  Number.isSafeInteger(value) && (value as number) > 0 ? (value as number) : 0

/**
 * The dashboard's session-derived props, from a signed-in user. Kept out of
 * the client component so server pages can call it.
 */
export function membershipPropsOf(
  user: unknown
): Omit<MembershipDashboardProps, "recognition" | "embedded"> {
  const u = (user && typeof user === "object" ? user : {}) as Record<
    string,
    unknown
  >
  const accepted = count(u.acceptedContributions)

  return {
    acceptedContributions: accepted,
    // The session's standing already reflects a moderator's revocation.
    recognitionRevoked: u.standing === "explorer" && accepted > 0,
    recentlyActive: u.recentlyActive === true,
    staffLibraries: staffLibrariesOf(user),
    teams: sessionTeamsOf(user),
    apiAccounts: apiAccountsOf(user),
  }
}
