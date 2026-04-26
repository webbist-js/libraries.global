import contentTypes from "./server/content-types"
import controllers from "./server/controllers"
import routes from "./server/routes"
import services from "./server/services"

export default {
  register({ strapi }: { strapi: any }) {},
  bootstrap({ strapi }: { strapi: any }) {},
  contentTypes,
  controllers,
  routes,
  services,
}
