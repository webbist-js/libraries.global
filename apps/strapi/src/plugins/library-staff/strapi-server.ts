import controller from "./server/controller"
import drawerController from "./server/drawer-controller"
import drawer from "./server/drawer-service"
import noticesController from "./server/notices-controller"
import notices from "./server/notices-service"
import routes from "./server/routes"
import staff from "./server/service"
import { refreshBranchNoticesAtMidnight } from "../../utils/library-notices"

import audit from "./server/content-types/staff-audit/schema.json"

export default {
  register() {},
  bootstrap({ strapi }: { strapi: any }) {
    // Staff audit retention (two years). Team invites live in the access
    // plugin and expire by date, so nothing else is pruned here.
    strapi.cron.add({
      "staff-prune": {
        task: () => strapi.plugin("library-staff").service("staff").prune(),
        options: { rule: "25 2 * * *" },
      },
    })
    strapi.cron.add({
      "branch-notice-midnight": {
        task: () =>
          refreshBranchNoticesAtMidnight(strapi).catch((error) =>
            strapi.log.warn("[notices] Midnight refresh failed", error)
          ),
        options: { rule: "12 * * * *" },
      },
    })
  },
  config: { default: {}, validator() {} },
  contentTypes: {
    "staff-audit": { schema: audit },
  },
  controllers: {
    staff: controller,
    notices: noticesController,
    drawer: drawerController,
  },
  services: { staff, notices, drawer },
  routes,
  policies: {},
  middlewares: {},
}
