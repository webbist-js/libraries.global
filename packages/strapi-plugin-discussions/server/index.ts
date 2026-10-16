import config from "./config"
import contentTypes from "./content-types"
import discussion from "./controllers"
import routes from "./routes"
import discussionService from "./service"

const permissions = [
  { uid: "read", displayName: "Read discussion moderation queue" },
  { uid: "review", displayName: "Review discussions and reports" },
  { uid: "manage", displayName: "Manage discussion subjects" },
]

export default {
  register() {},
  async bootstrap({ strapi }: { strapi: any }) {
    await strapi.service("admin::permission").actionProvider.registerMany(
      permissions.map((permission) => ({
        ...permission,
        section: "plugins",
        pluginName: "discussions",
      }))
    )
    // Cron may be disabled in the host. Successful writes also drain the outbox after commit.
    if (strapi.config.get("server.cron.enabled"))
      strapi.cron.add({
        "discussions-outbox": {
          task: async () => {
            await strapi
              .plugin("discussions")
              .service("discussion")
              .flushNotifications()
          },
          options: { rule: "* * * * *" },
        },
      })
    await strapi
      .plugin("discussions")
      .service("discussion")
      .flushNotifications()
  },
  destroy({ strapi }: { strapi: any }) {
    strapi.cron?.remove?.("discussions-outbox")
  },
  config,
  contentTypes,
  routes,
  controllers: { discussion },
  services: { discussion: discussionService },
  policies: {},
  middlewares: {},
}
