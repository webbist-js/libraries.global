import "server-only"

import { fetchOwnProfile } from "@/lib/own-profile-server"

/** Owner-only snapshot shared by the account view and contribution workspace. */
export async function readMembershipData(
  user: Parameters<typeof fetchOwnProfile>[0]
) {
  const profile = await fetchOwnProfile(user)

  return { profile, asOf: Date.now() }
}
