// https://docs.strapi.io/dev-docs/configurations/cron

import {
  handleAutoPaused,
  purgeOAuthDrafts,
} from "../src/plugins/events/server/cron"
import { resyncExpiredRoleGrants } from "../src/utils/role-grants"

// Grants that expire fire no lifecycle: re-derive the role of anyone whose
// grant expired in the last two days (the bridge already ignores them).
const resyncExpiredRoleGrantsJob = {
  task: async ({ strapi }: { strapi: any }) => {
    try {
      const { users } = await resyncExpiredRoleGrants(strapi)
      strapi.log.info(`[role-grants] Re-derived roles for ${users} users`)
    } catch (err) {
      strapi.log.warn("[role-grants] Expired grant resync failed:", err)
    }
  },
  options: {
    rule: "0 4 * * *",
  },
}

const eventFeedsJob = {
  task: async ({ strapi }: { strapi: any }) => {
    try {
      const { handled } = await handleAutoPaused(strapi)
      const { deleted } = await purgeOAuthDrafts(strapi)
      if (handled || deleted)
        strapi.log.info(
          `[events] auto-paused handled ${handled}, OAuth drafts purged ${deleted}`
        )
    } catch (err) {
      strapi.log.warn("[events] feed housekeeping failed:", err)
    }
  },
  options: { rule: "*/15 * * * *" },
}

export default {
  resyncExpiredRoleGrants: resyncExpiredRoleGrantsJob,
  eventFeeds: eventFeedsJob,
}
