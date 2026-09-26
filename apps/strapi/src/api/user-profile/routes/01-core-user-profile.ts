import { factories } from "@strapi/strapi"

// Read-only core routes. Profile writes go exclusively through the auth-bridge
// (bridge-secret gated, field allowlist, scoped to the session's baUserId).
// Exposing core update/delete would let any role holding that permission edit
// any profile, including contributorRole and isVerifiedLibrarian.
export default factories.createCoreRouter("api::user-profile.user-profile", {
  only: ["find", "findOne"],
})
