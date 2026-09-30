/**
 * region router
 *
 * The core list and detail routes always answer with the server-owned
 * populate shape (see middlewares/region-populate.ts).
 */

import { factories } from "@strapi/strapi"

export default factories.createCoreRouter("api::region.region", {
  config: {
    find: {
      middlewares: [
        { name: "api::region.region-populate", config: { view: "list" } },
      ],
    },
    findOne: {
      middlewares: [
        { name: "api::region.region-populate", config: { view: "detail" } },
      ],
    },
  },
})
