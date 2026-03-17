import { factories } from "@strapi/strapi"

export default factories.createCoreController(
  "api::continent.continent",
  ({ strapi }) => ({
    async homepage(ctx) {
      const locale =
        typeof ctx.query.locale === "string" ? ctx.query.locale : undefined
      const status = ctx.query.status === "draft" ? "draft" : "published"

      const continentService = strapi.service("api::continent.continent") as {
        getHomepageSummaries: (params: {
          locale?: string
          status: "draft" | "published"
        }) => Promise<unknown[]>
      }

      const data = await continentService.getHomepageSummaries({
        locale,
        status,
      })

      ctx.body = {
        data,
        meta: {},
      }
    },
  })
)
