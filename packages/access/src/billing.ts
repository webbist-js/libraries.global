import { resolveEntitlements, type EntitlementInput } from "./entitlements"

/** Private billing projection. Community roles and trust never belong here. */
export interface PaidMembership {
  mode: "sandbox" | "live"
  plan: "supporter" | "pro"
  status: string
  interval: "month" | "year"
  currency: string
  unitAmount: number
  memberSince: string
  periodEnd: string | null
  paidThrough: string | null
  pastDueSince: string | null
  cancelAtPeriodEnd: boolean
  revoked: boolean
  /** Last settled catalogue price, retained across founding-price catalogue changes. */
  settledPriceId?: string
  graceExpired?: boolean
}

/** Provider status alone cannot grant access: a settled invoice must cover it. */
export function paidMembershipInput(
  membership: PaidMembership | null | undefined
): EntitlementInput["subscription"] {
  if (
    !membership ||
    membership.revoked ||
    membership.graceExpired ||
    !membership.paidThrough
  )
    return null

  return {
    plan: membership.plan,
    status: membership.status,
    periodEnd: membership.paidThrough,
    paidThrough: membership.paidThrough,
    pastDueSince: membership.pastDueSince,
  }
}

export function selectPaidMembership(
  memberships: readonly PaidMembership[],
  now = new Date()
) {
  let best: PaidMembership | null = null
  for (const membership of memberships) {
    const access = resolveEntitlements({
      signedIn: true,
      now,
      subscription: paidMembershipInput(membership),
    })
    if (access.source !== "paid") continue
    if (
      !best ||
      (membership.plan === "pro" && best.plan === "supporter") ||
      (membership.plan === best.plan &&
        (membership.paidThrough ?? "") > (best.paidThrough ?? ""))
    )
      best = membership
  }

  return best
}

/** Strict bridge guard: malformed financial projections never become access. */
export function isPaidMembership(value: unknown): value is PaidMembership {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const v = value as Record<string, unknown>
  const date = (d: unknown) =>
    d === null || (typeof d === "string" && Number.isFinite(Date.parse(d)))

  return (
    (v.mode === "sandbox" || v.mode === "live") &&
    (v.plan === "pro" || v.plan === "supporter") &&
    (v.interval === "month" || v.interval === "year") &&
    typeof v.status === "string" &&
    v.status.length < 40 &&
    typeof v.currency === "string" &&
    /^[a-z]{3}$/.test(v.currency) &&
    typeof v.unitAmount === "number" &&
    Number.isSafeInteger(v.unitAmount) &&
    v.unitAmount >= 0 &&
    typeof v.memberSince === "string" &&
    date(v.memberSince) &&
    date(v.periodEnd) &&
    date(v.paidThrough) &&
    date(v.pastDueSince) &&
    (v.settledPriceId === undefined ||
      (typeof v.settledPriceId === "string" &&
        /^price_[\da-z_]+$/i.test(v.settledPriceId))) &&
    typeof v.cancelAtPeriodEnd === "boolean" &&
    typeof v.revoked === "boolean" &&
    (v.graceExpired === undefined || typeof v.graceExpired === "boolean")
  )
}
