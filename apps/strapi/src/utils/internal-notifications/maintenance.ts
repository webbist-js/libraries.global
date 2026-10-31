import type { Core } from "@strapi/strapi"

import { cmsMaintenanceStatus } from "../cms-maintenance"
import type { InternalEvent } from "./slack"

/** Existing private operational alerts, with no account or host identifiers. */
export async function maintenanceHealthEvent(
  strapi: Core.Strapi,
  now = new Date()
): Promise<InternalEvent | null> {
  if (process.env.CMS_MAINTENANCE_REQUIRED !== "true") return null
  const health = await cmsMaintenanceStatus(strapi, now).catch(() => ({
    ok: false,
  }))
  if (health.ok) return null

  return {
    eventKey: `maintenance-health:${now.toISOString().slice(0, 10)}`,
    kind: "service_alert",
    title: "Scheduled maintenance needs attention",
    detail:
      "One or more maintenance jobs failed or missed their completion interval. Inspect the private maintenance receipts and timer logs. Retention and lifecycle jobs retry independently.",
    eventAt: now.toISOString(),
  }
}
