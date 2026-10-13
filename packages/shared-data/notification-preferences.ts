export const NOTIFICATION_DEFAULTS = {
  weeklyDigest: false,
  weeklyReport: false,
  editsReviewed: true,
  drives: true,
  newFollowers: false,
  recognition: false,
  editorialMessages: true,
  soundOn: false,
  marketing: false,
  productUpdates: false,
} as const

export type NotificationPreference = keyof typeof NOTIFICATION_DEFAULTS

/** Patch booleans only. Consent evidence can only be written by the server. */
export function mergeNotificationPreferences(
  existing: unknown,
  patch: unknown,
  now = new Date()
): Record<string, unknown> {
  if (!patch || typeof patch !== "object" || Array.isArray(patch))
    throw new Error("Invalid preferences")
  const changes = patch as Record<string, unknown>
  if (
    Object.entries(changes).some(
      ([key, value]) =>
        !Object.hasOwn(NOTIFICATION_DEFAULTS, key) || typeof value !== "boolean"
    )
  )
    throw new Error("Invalid preferences")
  const previous =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? existing
      : {}
  const result: Record<string, unknown> = {
    ...NOTIFICATION_DEFAULTS,
    ...previous,
    ...changes,
  }
  if ("weeklyDigest" in changes)
    result.digestConsentedAt = changes.weeklyDigest ? now.toISOString() : null
  if ("weeklyReport" in changes)
    result.reportConsentedAt = changes.weeklyReport ? now.toISOString() : null
  if ("marketing" in changes)
    result.productConsentedAt = changes.marketing ? now.toISOString() : null

  return result
}
