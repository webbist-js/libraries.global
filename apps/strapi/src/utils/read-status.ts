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
