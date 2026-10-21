/** Shared recursive privacy boundary for CMS events and transactions.
 * Removes credentials, request bodies and private identity/location fields,
 * strips URL secrets and console breadcrumbs, and retains only safe headers.
 */

import { scrubTelemetryEvent } from "@repo/shared-data"

export interface ScrubbableEvent {
  request?: {
    url?: string
    method?: string
    headers?: Record<string, unknown>
    cookies?: unknown
    data?: unknown
    [key: string]: unknown
  }
  user?: { id?: string | number; [key: string]: unknown }
  [key: string]: unknown
}

export function scrubSentryEvent<E extends ScrubbableEvent>(event: E): E {
  return scrubTelemetryEvent(event)
}
