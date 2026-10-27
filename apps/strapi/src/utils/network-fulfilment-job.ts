import type { Core } from "@strapi/strapi"

import { withLeaderLock } from "./leader-lock"
import { runNetworkFulfilment } from "../plugins/access/server/services/network-fulfilment"

/** Cron and an external scheduler must never process the same batch together. */
export function runNetworkFulfilmentJob(strapi: Core.Strapi) {
  return withLeaderLock(strapi, 7_420_102, () => runNetworkFulfilment(strapi))
}
