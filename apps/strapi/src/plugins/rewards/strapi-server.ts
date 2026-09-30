import contentTypes from "./server/content-types"
import controllers from "./server/controllers"
import routes from "./server/routes"
import services from "./server/services"
import {
  REWARDS_SNAPSHOT_LOCK_KEY,
  withLeaderLock,
} from "./server/utils/leader-lock"

export default {
  register({ strapi }: { strapi: any }) {},
  async bootstrap({ strapi }: { strapi: any }) {
    await strapi.service("admin::permission").actionProvider.registerMany([
      {
        section: "plugins",
        displayName: "View rewards data",
        uid: "read",
        pluginName: "rewards",
      },
      {
        section: "plugins",
        displayName: "Manually award or deduct points",
        uid: "award",
        pluginName: "rewards",
      },
    ])

    // Weekly leaderboard snapshot — runs every Monday at 00:05 UTC.
    // Captures the previous week's ranked list so rankChange deltas can be
    // computed when the leaderboard is fetched. With several instances,
    // only the one holding the advisory lock runs it.
    strapi.cron.add({
      "rewards-leaderboard-snapshot": {
        task: async () => {
          try {
            await withLeaderLock(strapi, REWARDS_SNAPSHOT_LOCK_KEY, () =>
              strapi.plugin("rewards").service("snapshot").takeWeeklySnapshot()
            )
          } catch (err) {
            strapi.log.error("[rewards] Leaderboard snapshot failed:", err)
          }
        },
        options: { rule: "5 0 * * 1" }, // Monday 00:05 UTC
      },
    })
  },
  config: { default: {}, validator() {} },
  contentTypes,
  controllers,
  middlewares: {},
  policies: {},
  routes,
  services,
}
