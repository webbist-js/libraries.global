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
        displayName: "Access the events dashboard",
        uid: "read",
        pluginName: "events",
      },
    ])
  },
  config: { default: {}, validator() {} },
  contentTypes,
  controllers,
  middlewares: {},
  policies: {},
  routes,
  services,
}
