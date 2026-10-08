import contentTypes from "./server/content-types"
import controllers from "./server/controllers"
import routes from "./server/routes"
import services from "./server/services"
import { backfillLibraryHistory } from "./server/services/history"
import { backfillSubmissionLocales } from "./server/utils/locales"
import { migrateReviewerPrefix } from "./server/utils/reviewer"

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
    // One-off, flag-guarded: bare admin ids in reviewedByUserId get `admin:`.
    try {
      await migrateReviewerPrefix(strapi)
    } catch (err) {
      strapi.log.error(
        "[content-moderation] reviewer prefix migration failed",
        err
      )
    }
    // One-off, flag-guarded: a Change Batch per pre-history library approval.
    try {
      await backfillLibraryHistory(strapi)
    } catch (err) {
      strapi.log.error(
        "[content-moderation] library history backfill failed",
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
