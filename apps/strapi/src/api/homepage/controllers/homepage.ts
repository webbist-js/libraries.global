/**
 * homepage controller
 */

import { factories } from "@strapi/strapi"

import { getHomepageStats } from "../../../utils/homepage-stats"

export default factories.createCoreController(
  "api::homepage.homepage",
  ({ strapi }) => ({
    // ── /homepage/stats ──────────────────────────────────────────────────────
    // Live community proof for the homepage, counted in the database and
    // memoised for five minutes (see utils/homepage-stats.ts).
    async stats(ctx) {
      ctx.body = { data: await getHomepageStats(strapi), meta: {} }
    },
  })
)
