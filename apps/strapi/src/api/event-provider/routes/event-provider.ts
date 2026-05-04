import { factories } from "@strapi/strapi"

export default factories.createCoreRouter(
  "api::event-provider.event-provider",
  {
    config: {
      find: { policies: ["global::isAuthenticated"] },
      findOne: { policies: ["global::isAuthenticated"] },
      create: { policies: [] },
      update: { policies: ["global::isAuthenticated"] },
      delete: { policies: ["global::isAuthenticated"] },
    },
  }
)
