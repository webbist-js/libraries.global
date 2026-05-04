import { factories } from "@strapi/strapi"

// Access to find/findOne/update/delete is controlled via the Strapi admin
// Roles & Permissions panel (restrict to authenticated or admin roles there).
// create is intentionally open so the public feed submission form can POST
// without requiring a user account.
export default factories.createCoreRouter("api::event-provider.event-provider")
