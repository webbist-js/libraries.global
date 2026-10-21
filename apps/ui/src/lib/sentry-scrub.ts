import { scrubTelemetryEvent } from "@repo/shared-data"
import type { RequestEventData } from "@sentry/nextjs"

/** Apply the shared recursive privacy boundary to events and transactions,
 * then retain only the user-agent header in frontend request metadata.
 * The generic signature accepts the SDK's error and transaction envelopes.
 */
export function scrubSentryEvent<T extends { request?: RequestEventData }>(
  event: T
): T {
  scrubTelemetryEvent(event)
  if (event.request) {
    delete event.request.data
    delete event.request.cookies
    delete event.request.query_string
    const ua = event.request.headers?.["user-agent"]
    event.request.headers = ua ? { "user-agent": ua } : {}
  }

  return event
}
