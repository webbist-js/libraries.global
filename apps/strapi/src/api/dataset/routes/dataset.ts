/**
 * dataset router. The registry is edited in the admin and seeded on
 * boot; the API only serves it.
 */

import { factories } from "@strapi/strapi"

export default factories.createCoreRouter("api::dataset.dataset", {
  only: ["find", "findOne"],
})
