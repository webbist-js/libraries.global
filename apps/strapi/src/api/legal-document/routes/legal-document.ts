import { factories } from "@strapi/strapi"

// Legal documents are edited in the admin only; the API just serves them.
export default factories.createCoreRouter(
  "api::legal-document.legal-document",
  { only: ["find", "findOne"] }
)
