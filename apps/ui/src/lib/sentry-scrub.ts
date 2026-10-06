import type { RequestEventData } from "@sentry/nextjs"

/**
 * Strips a Sentry event's request data down to the bare minimum before it's
 * sent: no body, no cookies, no query string, and only the `user-agent`
 * header. Request bodies can hold event feed credentials and other personal
 * details, and the OAuth callback's URL carries a `code` query parameter, so
 * the URL is reduced to its origin and pathname. Shared between `beforeSend`
 * and `beforeSendTransaction` in both the server and edge configs. Mirrors
 * Strapi's sentry-scrub.
 *
 * Generic (rather than typed against Sentry's `ErrorEvent`/`TransactionEvent`,
 * which aren't surfaced through `@sentry/nextjs`'s public types) so it still
 * matches both `beforeSend` and `beforeSendTransaction`'s event parameter
 * structurally.
 */
export function scrubSentryEvent<T extends { request?: RequestEventData }>(
  event: T
): T {
  if (event.request) {
    delete event.request.data
    delete event.request.cookies
    delete event.request.query_string
    const ua = event.request.headers?.["user-agent"]
    event.request.headers = ua ? { "user-agent": ua } : {}

    if (typeof event.request.url === "string") {
      try {
        const u = new URL(event.request.url)
        event.request.url = `${u.origin}${u.pathname}`
      } catch {
        // Not a parseable absolute URL: leave it as-is rather than guess.
      }
    }
  }

  return event
}
