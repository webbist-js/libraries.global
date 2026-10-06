/**
 * drive router. No core REST: every route a Drive needs (public reads,
 * board-only writes) is a custom route in `drive-public.ts`.
 */

import { factories } from "@strapi/strapi"

export default factories.createCoreRouter("api::drive.drive", {
  only: [],
})
