import { nextContributorNumber } from "../utils/username"

const PROFILE = "api::user-profile.user-profile"

/** Retry-safe provisioning: a partial signup is repaired before any session. */
export async function ensureProfile(
  strapi: any,
  user: { id: string; name?: string }
) {
  return strapi.db.transaction(async ({ trx }) => {
    await trx.raw("select pg_advisory_xact_lock(hashtextextended(?, 0))", [
      `auth-profile:${user.id}`,
    ])
    const existing = await strapi.db.query(PROFILE).findOne({
      where: { baUserId: user.id },
    })
    if (existing) return existing
    const [firstName = "", ...rest] = (user.name ?? "").trim().split(/\s+/)

    return strapi.documents(PROFILE).create({
      data: {
        baUserId: user.id,
        authUser: Number(user.id),
        firstName,
        lastName: rest.join(" "),
        contributorNumber: await nextContributorNumber(strapi),
      },
    })
  })
}
