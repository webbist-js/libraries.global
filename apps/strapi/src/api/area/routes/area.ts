/**
 * area router
 *
 * The core list and detail routes always answer with the server-owned
 * populate shape (see middlewares/area-populate.ts).
 */

import { factories } from "@strapi/strapi"

export default factories.createCoreRouter("api::area.area", {
  config: {
    find: {
      middlewares: [
        { name: "api::area.area-populate", config: { view: "list" } },
      ],
    },
    findOne: {
      middlewares: [
        { name: "api::area.area-populate", config: { view: "detail" } },
      ],
    },
  },
})
