/** A new sign-in, rather than session renewal, proves a sensitive action. */
export const FRESH_AUTH_MS = 5 * 60_000
export function sessionIsFresh(
  session: { createdAt?: Date | string } | null | undefined,
  now = Date.now()
) {
  const created = session?.createdAt
    ? new Date(session.createdAt).getTime()
    : Number.NaN

  return (
    Number.isFinite(created) &&
    created <= now + 30_000 &&
    created >= now - FRESH_AUTH_MS
  )
}
export function reauthenticationResponse(
  returnTo: "/staff" | "/developers" | "/profile/settings"
) {
  return Response.json(
    {
      error: "reauthentication_required",
      reauthUrl: `/auth/signin?callbackUrl=${encodeURIComponent(returnTo)}`,
    },
    { status: 403, headers: { "Cache-Control": "no-store" } }
  )
}
/** Called only after an explicit action; returns to the relevant workspace. */
export function redirectForReauthentication(value: {
  error?: unknown
  reauthUrl?: unknown
}) {
  if (
    value.error !== "reauthentication_required" ||
    typeof window === "undefined"
  )
    return false
  const allowed = new Set(
    ["/staff", "/developers", "/profile/settings", "/moderation"].map(
      (path) => `/auth/signin?callbackUrl=${encodeURIComponent(path)}`
    )
  )
  if (typeof value.reauthUrl !== "string" || !allowed.has(value.reauthUrl))
    return false
  window.location.assign(value.reauthUrl)

  return true
}
