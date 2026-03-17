/**
 * page router
 */

import { factories } from "@strapi/strapi"

export default factories.createCoreRouter("api::page.page", {
  config: {
    find: {
      middlewares: ["api::page.populate-page"],
    },
    findOne: {
      middlewares: ["api::page.populate-page"],
    },
  },
})
