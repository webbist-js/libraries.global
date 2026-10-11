import {
  validateOpeningSchedule,
  normalizeOpeningSchedule,
} from "@repo/shared-data"
import type { Core } from "@strapi/strapi"
import { errors } from "@strapi/utils"

export function registerOpeningScheduleMiddleware({
  strapi,
}: {
  strapi: Core.Strapi
}) {
  strapi.documents.use(async (context, next) => {
    if (
      !["api::library.library", "api::library-notice.library-notice"].includes(
        context.uid
      ) ||
      !["create", "update"].includes(context.action)
    )
      return next()
    const data = (context.params as { data?: Record<string, unknown> }).data
    const key =
      context.uid === "api::library.library" ? "openingTimes" : "hours"
    if (data?.[key] != null) {
      const issues = validateOpeningSchedule(data[key])
      if (issues.length) throw new errors.ValidationError(issues.join("; "))
      data[key] = normalizeOpeningSchedule(data[key])
    }

    return next()
  })
}
