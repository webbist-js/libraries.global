import controller from "./server/controller"
import routes from "./server/routes"
import live from "./server/service"
import { observeMaintenance } from "../../utils/cms-maintenance"
import {
  registerMobileStopIndex,
  syncMobileStops,
} from "../../utils/mobile-stop-index"

import events from "./server/content-types/live-event/schema.json"
import sessions from "./server/content-types/live-session/schema.json"
import settings from "./server/content-types/live-setting/schema.json"

export default {
  register() {},
  async bootstrap({ strapi }: { strapi: any }) {
    if (process.env.MOBILE_LIVE_ENABLED === "false")
      strapi.log.warn(
        "[mobile-live] Emergency kill switch is active. All active sharing will end."
      )
    await observeMaintenance(strapi, "mobile-live-stop", () =>
      strapi.plugin("mobile-libraries").service("live").sweep()
    )
    await observeMaintenance(strapi, "mobile-live-retention", () =>
      strapi.plugin("mobile-libraries").service("live").prune()
    )
    registerMobileStopIndex(strapi)
    strapi.cron.add({
      "mobile-live-stop": {
        task: () =>
          observeMaintenance(strapi, "mobile-live-stop", () =>
            strapi.plugin("mobile-libraries").service("live").sweep()
          ),
        options: { rule: "*/5 * * * *" },
      },
      "mobile-live-retention": {
        task: () =>
          observeMaintenance(strapi, "mobile-live-retention", () =>
            strapi.plugin("mobile-libraries").service("live").prune()
          ),
        options: { rule: "35 2 * * *" },
      },
    })
  },
  config: { default: {}, validator() {} },
  contentTypes: {
    "live-setting": { schema: settings },
    "live-session": { schema: sessions },
    "live-event": { schema: events },
  },
  controllers: { live: controller },
  services: {
    live,
    "stop-index": ({ strapi }: { strapi: any }) => ({
      reindexLibrary: (id: string) => syncMobileStops(strapi, id),
    }),
  },
  routes,
  policies: {},
  middlewares: {},
}
