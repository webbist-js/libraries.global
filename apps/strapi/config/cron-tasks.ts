// https://docs.strapi.io/dev-docs/configurations/cron

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

export default {
  resyncExpiredRoleGrants: resyncExpiredRoleGrantsJob,
}
