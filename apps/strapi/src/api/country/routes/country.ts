/**
 * country router
 *
 * The core list and detail routes always answer with the server-owned
 * populate shape (see middlewares/country-populate.ts).
 */

import { factories } from "@strapi/strapi"

export default factories.createCoreRouter("api::country.country", {
  config: {
    find: {
      middlewares: [
        { name: "api::country.country-populate", config: { view: "list" } },
      ],
    },
    findOne: {
      middlewares: [
        { name: "api::country.country-populate", config: { view: "detail" } },
      ],
    },
  },
})
