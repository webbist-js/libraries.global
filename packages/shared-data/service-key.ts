import { createHash, timingSafeEqual } from "node:crypto"

/** Rotation overlap is opt-in, expires, and is capped at one day. Senders
 * always use the current key; this function is only for authenticated receivers.
 */
export function matchesBridgeSecret(
  provided: unknown,
  env = process.env,
  now = Date.now()
) {
  if (typeof provided !== "string" || !provided || !env.STRAPI_BRIDGE_SECRET)
    return false
  const equal = (expected: string) =>
    timingSafeEqual(
      createHash("sha256").update(provided).digest(),
      createHash("sha256").update(expected).digest()
    )
  if (equal(env.STRAPI_BRIDGE_SECRET)) return true
  const until = Date.parse(env.STRAPI_BRIDGE_PREVIOUS_VALID_UNTIL ?? "")

  return Boolean(
    env.STRAPI_BRIDGE_PREVIOUS_SECRET &&
    Number.isFinite(until) &&
    until > now &&
    until <= now + 86_400_000 &&
    equal(env.STRAPI_BRIDGE_PREVIOUS_SECRET)
  )
}
