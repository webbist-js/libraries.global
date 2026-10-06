/**
 * drive router. No core REST: every route a Drive needs (public reads,
 * board-only writes) is a custom route in `drive-public.ts`.
 */

import { factories } from "@strapi/strapi"

// `as any`: the drive content type is not yet in the generated types
// (`types/generated/contentTypes.d.ts`), which Strapi writes on boot or via
// `generate:types`. Regenerate and drop the cast once that runs.
export default factories.createCoreRouter("api::drive.drive" as any, {
  only: [],
})
