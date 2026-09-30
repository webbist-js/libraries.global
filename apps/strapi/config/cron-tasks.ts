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

// Re-list every catalogue's branches weekly: keeps branch→Library matches
// fresh and flags catalogues whose sites have changed or started blocking us.
const catalogueBranchDiscoveryJob = {
  task: async ({ strapi }: { strapi: any }) => {
    const catalogues = await strapi
      .documents("api::catalogue.catalogue")
      .findMany({
        filters: { branchStatus: { $ne: "unsupported" } },
        fields: ["documentId", "name"],
        // findMany ignores `pagination` in Strapi 5.55: flat start/limit.
        start: 0,
        limit: 1000,
        sort: ["id:asc"],
      })
    strapi.log.info(
      `[catalogue] Branch discovery for ${catalogues.length} catalogues`
    )
    const service = strapi.service("api::catalogue.catalogue")
    // Few at a time: these are small council sites. Per-host throttling in
    // @repo/catalogues spaces out requests to shared hosts.
    await mapLimit(
      catalogues as { documentId: string; name: string }[],
      3,
      (c) =>
        service
          .discoverBranches(c.documentId)
          .catch((err: Error) =>
            strapi.log.warn(`[catalogue] ${c.name}: ${err.message}`)
          )
    )
    strapi.log.info("[catalogue] Branch discovery complete")
  },
  options: {
    rule: "0 0 2 * * 1",
  },
}

export default {
  quickWinsRefreshJob,
  catalogueBranchDiscoveryJob,
}
