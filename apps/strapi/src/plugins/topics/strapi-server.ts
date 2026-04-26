import { bootstrap as bootstrapTopics } from "./server/bootstrap"
import contentTypes from "./server/content-types"
import controllers from "./server/controllers"
import routes from "./server/routes"
import services from "./server/services"

export default {
  register({ strapi }: { strapi: any }) {},
  bootstrap: bootstrapTopics,
  contentTypes,
  controllers,
  routes,
  services,
}
