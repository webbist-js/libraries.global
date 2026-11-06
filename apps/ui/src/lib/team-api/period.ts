/**
 * Paid-period rules. Pure: callers pass the clock and environment mode.
 *
 * - The quota period is the latest *settled* Stripe subscription item period
 *   `[start, end)`. A partial first period gets the full allowance.
 * - A renewal opens a new allowance only once its invoice is paid; a failed or
 *   pending payment leaves no current period, so no free usage.
 * - A past-due subscription keeps its already-settled period but never
 *   authorises overage.
 */
import { API_DIMENSIONS } from "./constants"
import type { ApiMembership, ApiPeriod } from "./types"

const ACCESS_STATUSES = new Set(["active", "past_due", "canceled"])

export function currentPeriod(
  membership: Pick<ApiMembership, "period" | "revoked"> | null | undefined,
  now: Date
): ApiPeriod | null {
  const period = membership?.period
  if (!period || membership.revoked) return null
  const start = Date.parse(period.start),
    end = Date.parse(period.end)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    return null

  return now.getTime() >= start && now.getTime() < end ? period : null
}

export function membershipCovered(
  membership: ApiMembership | null | undefined,
  mode: "sandbox" | "live",
  now: Date
): membership is ApiMembership {
  return Boolean(
    membership &&
    membership.mode === mode &&
    !membership.revoked &&
    ACCESS_STATUSES.has(membership.status) &&
    membership.paidThrough &&
    Date.parse(membership.paidThrough) > now.getTime() &&
    currentPeriod(membership, now)
  )
}

/**
 * Overage needs a current settled period, a subscription in good standing
 * (never past-due grace) and every metered overage item bound to the offer.
 */
export function overagePermitted(
  membership: ApiMembership | null | undefined,
  mode: "sandbox" | "live",
  now: Date
) {
  return (
    membershipCovered(membership, mode, now) &&
    membership.status === "active" &&
    API_DIMENSIONS.every(
      (d) => membership.offer.overagePrices[d] && membership.overageItems[d]
    )
  )
}
