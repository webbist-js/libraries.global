import contentTypes from "./server/content-types"
import controllers from "./server/controllers"
import routes from "./server/routes"
import services from "./server/services"

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
  },
  config: { default: {}, validator() {} },
  contentTypes,
  controllers,
  middlewares: [],
  policies: [],
  routes,
  services,
}
