import contentTypes from "./server/content-types"
import controllers from "./server/controllers"
import routes from "./server/routes"
import services from "./server/services"
import { ensureEventIndexes } from "./server/utils/ensure-event-indexes"

export default {
  register({ strapi }: { strapi: any }) {},
  async bootstrap({ strapi }: { strapi: any }) {
    await strapi.service("admin::permission").actionProvider.registerMany([
      {
        section: "plugins",
        displayName: "Access the events dashboard",
        uid: "read",
        pluginName: "events",
      },
      {
        section: "plugins",
        displayName: "Manage provider credentials and trigger syncs",
        uid: "manage-credentials",
        pluginName: "events",
      },
      {
        section: "plugins",
        displayName: "Review pending events",
        uid: "review",
        pluginName: "events",
      },
      {
        section: "plugins",
        displayName: "Reveal event credentials (logged)",
        uid: "reveal-credentials",
        pluginName: "events",
      },
    ])

    // Fresh-DB fallback for the events migration (runs after schema sync).
    await ensureEventIndexes(strapi)
  },
  config: { default: {}, validator() {} },
  contentTypes,
  controllers,
  middlewares: {},
  policies: {},
  routes,
  services,
}
