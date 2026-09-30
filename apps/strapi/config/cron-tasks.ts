// https://docs.strapi.io/dev-docs/configurations/cron

import { mapLimit } from "../src/utils/map-limit"

const quickWinsRefreshJob = {
  task: async ({ strapi }: { strapi: any }) => {
    strapi.log.info("[quick-wins] Starting refresh for active users")
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const profiles = (await strapi.db
      .query("api::user-profile.user-profile")
      .findMany({
        where: {
          lastActivityDate: { $gte: cutoff.toISOString().slice(0, 10) },
        },
        select: ["baUserId"],
      })) as { baUserId: string }[]

    strapi.log.info(`[quick-wins] Refreshing wins for ${profiles.length} users`)

    // Five at a time: each refresh is a handful of queries, and a burst of
    // fifty at once starved the pool for everything else.
    await mapLimit(profiles, 5, (p) =>
      strapi
        .service("api::user-profile.quick-wins")
        .computeAndSave(p.baUserId)
        .catch((err: unknown) =>
          strapi.log.warn(`[quick-wins] Failed for ${p.baUserId}:`, err)
        )
    )

    strapi.log.info("[quick-wins] Refresh complete")
  },
  options: {
    rule: "0 */4 * * *",
  },
}

export default {
  quickWinsRefreshJob,
}
