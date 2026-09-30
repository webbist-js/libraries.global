/**
 * continent router
 *
 * The core list and detail routes always answer with the server-owned
 * populate shape (see middlewares/continent-populate.ts).
 */

import { factories } from "@strapi/strapi"

export default factories.createCoreRouter("api::continent.continent", {
  config: {
    find: {
      middlewares: [
        { name: "api::continent.continent-populate", config: { view: "list" } },
      ],
    },
    findOne: {
      middlewares: [
        {
          name: "api::continent.continent-populate",
          config: { view: "detail" },
        },
      ],
    },
  },
})
