import { isValidServiceSecret } from "../utils/service-secret"

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
 */
export function stripDraftStatus() {
  return async (ctx: any, next: () => Promise<unknown>) => {
    const path: string = ctx.path ?? ""
    if (
      path.startsWith("/api/") &&
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

export default (_config: unknown, _ctx: { strapi: unknown }) =>
  stripDraftStatus()
