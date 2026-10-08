import { registerPermissions } from "./server/bootstrap"
import contentTypes from "./server/content-types"
import controllers from "./server/controllers"
import routes from "./server/routes"
import services from "./server/services"

export default {
  register() {},
  async bootstrap({ strapi }: { strapi: any }) {
    await registerPermissions(strapi)
  },
  config: { default: {}, validator() {} },
  contentTypes,
  controllers,
  middlewares: {},
  policies: {},
  routes,
  services,
}
