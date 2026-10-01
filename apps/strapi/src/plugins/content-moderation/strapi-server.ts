import contentTypes from "./server/content-types"
import controllers from "./server/controllers"
import routes from "./server/routes"
import services from "./server/services"
import { backfillSubmissionLocales } from "./server/utils/locales"

export default {
  register({ strapi }: { strapi: any }) {},
  async bootstrap({ strapi }: { strapi: any }) {
    await strapi.service("admin::permission").actionProvider.registerMany([
      {
        section: "plugins",
        displayName: "Access the moderation queue",
        uid: "read",
        pluginName: "content-moderation",
      },
      {
        section: "plugins",
        displayName: "Update submission status",
        uid: "update",
        pluginName: "content-moderation",
      },
    ])
    // One-off, flag-guarded: Submissions from before they carried a locale.
    try {
      await backfillSubmissionLocales(strapi)
    } catch (err) {
      strapi.log.error(
        "[content-moderation] submission locale backfill failed",
        err
      )
    }
  },
  config: { default: {}, validator() {} },
  contentTypes,
  controllers,
  middlewares: {},
  policies: {},
  routes,
  services,
}
