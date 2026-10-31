import { bridgeBaUserId } from "./service-secret"

/** This header is asserted by the UI from the server session, never forwarded
 * from browser headers. It is authoritative only with the authenticated bridge.
 */
export function requireFreshBridgeAuth(
  ctx: {
    request?: { headers?: Record<string, string | undefined> }
    status?: number
    body?: unknown
  },
  now = Date.now()
) {
  const headers = ctx.request?.headers ?? {}
  const created = Date.parse(headers["x-ba-session-created-at"] ?? "")
  if (
    bridgeBaUserId(ctx) &&
    Number.isFinite(created) &&
    created <= now + 30_000 &&
    created >= now - 300_000
  )
    return true
  ctx.status = 403
  ctx.body = {
    error: "reauthentication_required",
    reauthUrl: "/auth/signin?callbackUrl=%2Fmoderation",
  }

  return false
}
