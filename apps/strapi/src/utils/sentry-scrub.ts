/**
 * Sentry `beforeSend` for the Strapi app.
 *
 * @strapi/plugin-sentry attaches the whole Koa request to an error event, so a
 * throw in a bridge route would ship the service secret, the caller's Strapi
 * JWT, session cookies and the JSON body (email, name, bio) to Sentry. This
 * strips all of that and keeps only what is useful for debugging: the url,
 * the method, harmless headers and the user's id.
 */

const DROPPED_HEADERS = new Set([
  "x-service-secret",
  "authorization",
  "cookie",
  "x-ba-user-email",
  "x-ba-user-name",
])

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
  const { request, user } = event
  if (request) {
    if (request.headers) {
      for (const name of Object.keys(request.headers)) {
        if (DROPPED_HEADERS.has(name.toLowerCase()))
          delete request.headers[name]
      }
    }
    delete request.cookies
    delete request.data
  }
  if (user) event.user = { id: user.id }

  return event
}
