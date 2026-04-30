// https://docs.strapi.io/dev-docs/configurations/cron

const sayHelloJob = {
  task: ({ strapi }: { strapi: any }) => {
    console.warn("A beautiful start to the week!")
  },
  options: {
    rule: "0 0 1 * * 1",
  },
}

const quickWinsRefreshJob = {
  task: async ({ strapi }: { strapi: any }) => {
    strapi.log.info("[quick-wins] Starting refresh for active users")
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const profiles = await strapi.db
      .query("api::user-profile.user-profile")
      .findMany({
        where: {
          lastActivityDate: { $gte: cutoff.toISOString().slice(0, 10) },
        },
        select: ["baUserId"],
      })

    strapi.log.info(`[quick-wins] Refreshing wins for ${profiles.length} users`)

    for (let i = 0; i < profiles.length; i += 50) {
      const batch = profiles.slice(i, i + 50)
      await Promise.all(
        batch.map((p: { baUserId: string }) =>
          strapi
            .service("api::user-profile.quick-wins")
            .computeAndSave(p.baUserId)
            .catch((err: unknown) =>
              strapi.log.warn(`[quick-wins] Failed for ${p.baUserId}:`, err)
            )
        )
      )
    }

    strapi.log.info("[quick-wins] Refresh complete")
  },
  options: {
    rule: "0 */4 * * *",
  },
}

export default {
  sayHelloJob,
  quickWinsRefreshJob,
}
