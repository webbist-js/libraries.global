import { isValidServiceSecret } from "./service-secret"

/** Draft content is only served to the Next.js server (bridge secret), never to the public. */
export function readStatus(ctx: {
  query?: Record<string, unknown>
  request: { headers: Record<string, unknown> }
}): "draft" | "published" {
  return ctx.query?.status === "draft" &&
    isValidServiceSecret(ctx.request.headers["x-service-secret"])
    ? "draft"
    : "published"
}

/** Read locale from query, returning undefined if not a non-empty string. */
export function readLocale(ctx: {
  query?: Record<string, unknown>
}): string | undefined {
  const locale = ctx.query?.locale

  return typeof locale === "string" && locale.length > 0 ? locale : undefined
}
