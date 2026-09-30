/**
 * library router
 *
 * The core list and detail routes always answer with the server-owned
 * populate shape (see middlewares/library-populate.ts).
 */

import { factories } from "@strapi/strapi"

export default factories.createCoreRouter("api::library.library", {
  config: {
    find: {
      middlewares: [
        { name: "api::library.library-populate", config: { view: "list" } },
      ],
    },
    findOne: {
      middlewares: [
        { name: "api::library.library-populate", config: { view: "detail" } },
      ],
    },
  },
})
