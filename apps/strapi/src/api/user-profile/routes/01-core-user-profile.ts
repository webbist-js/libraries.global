import { factories } from "@strapi/strapi"

// Owner and public profile projections have dedicated controllers. Never expose
// the core model (private settings and actor identifiers) to REST API tokens.
export default factories.createCoreRouter("api::user-profile.user-profile", {
  only: [],
})
