import { isValidServiceSecret } from "../utils/service-secret"

const DEFAULT_REST_PREFIX = "/api"

/**
 * Reads the content-API prefix from `api.rest.prefix` (Strapi lets this be
 * reconfigured, though almost nobody does), falling back to `/api`. Guards
 * against a missing `strapi` — the middleware factory is called once at
 * registration with `{ strapi }` in `ctx`, but tests may exercise the
 * returned middleware directly with an empty context.
 */
function getRestPrefix(strapi: unknown): string {
  const config = (strapi as { config?: { get?: unknown } } | undefined)?.config
  if (config && typeof config.get === "function") {
    const prefix = (config.get as (key: string, fallback: string) => unknown)(
      "api.rest.prefix",
      DEFAULT_REST_PREFIX
    )
    if (typeof prefix === "string" && prefix.length > 0) return prefix
  }

  return DEFAULT_REST_PREFIX
}

/**
 * True when `path` (already lowercased and slash-collapsed) is the content
 * API: `@koa/router` matches routes case-insensitively and tolerates
 * repeated slashes, so a raw `path.startsWith("/api/")` check can be
 * bypassed with `/API/wiki-articles` or `//api/x` while the router still
 * dispatches it as a content-API request.
 */
function isContentApiPath(normalizedPath: string, prefix: string): boolean {
  const normalizedPrefix = prefix.toLowerCase()

  return (
    normalizedPath === normalizedPrefix ||
    normalizedPath.startsWith(`${normalizedPrefix}/`)
  )
}

/**
 * True when a raw querystring key (before `=`) names the `status` param,
 * including qs bracket forms such as `status[0]` or `status[$eq]`.
 * Keys are decoded the way qs decodes them, so `st%61tus` is caught too.
 */
function isStatusKey(rawKey: string): boolean {
  let key = rawKey
  try {
    key = decodeURIComponent(rawKey.replaceAll("+", " "))
  } catch {
    // Malformed escape: qs leaves it undecoded, so compare it as-is.
  }

  return key === "status" || key.startsWith("status[")
}

/** Returns `querystring` without any `status` params, other params untouched. */
export function stripStatusFromQuerystring(querystring: string): string {
  if (!querystring) return querystring

  return querystring
    .split("&")
    .filter((part) => part !== "" && !isStatusKey(part.split("=")[0]))
    .join("&")
}

/**
 * C1: Strapi's core REST controllers honour `?status=draft` for anyone, so
 * drafts of every draft-and-publish type leak to anonymous callers. Only the
 * Next.js server (holding the bridge secret) may read drafts: for everyone
 * else, `status` is removed from /api/* requests before routing, so the
 * core controllers fall back to published. `readStatus()` in the custom
 * controllers stays as defence in depth.
 *
 * `strapi::query` makes `ctx.query` a getter that re-parses
 * `ctx.querystring`, so the raw querystring is rewritten (not just the
 * parsed object) — nothing downstream can re-read the stripped param.
 *
 * The path check is case-insensitive and collapses repeated slashes to
 * match how `@koa/router` dispatches routes — a case-sensitive
 * `path.startsWith("/api/")` lets `GET /API/wiki-articles?status=draft`
 * (or `//api/...`) through untouched while the router still treats it as
 * a content-API request.
 */
export function stripDraftStatus(strapi?: unknown) {
  const prefix = getRestPrefix(strapi)

  return async (ctx: any, next: () => Promise<unknown>) => {
    const rawPath: string = ctx.path ?? ""
    const normalizedPath = rawPath.toLowerCase().replaceAll(/\/{2,}/g, "/")
    if (
      isContentApiPath(normalizedPath, prefix) &&
      !isValidServiceSecret(ctx.request?.headers?.["x-service-secret"])
    ) {
      const qs: string = ctx.querystring ?? ""
      const stripped = stripStatusFromQuerystring(qs)
      if (stripped !== qs) ctx.querystring = stripped

      // Belt and braces: whatever the parser produced, no `status` survives.
      const query = ctx.query
      if (query && typeof query === "object" && "status" in query)
        delete query.status
      const requestQuery = ctx.request?.query
      if (
        requestQuery &&
        typeof requestQuery === "object" &&
        "status" in requestQuery
      )
        delete requestQuery.status
    }

    await next()
  }
}

export default (_config: unknown, ctx: { strapi: unknown }) =>
  stripDraftStatus(ctx?.strapi)
