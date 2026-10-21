/** Private Team payment projection shared by the application and CMS bridge. */
export type PaidTeamMembership = {
  mode: "sandbox" | "live"
  status: string
  priceId: string
  unitAmount: number
  currency: string
  seats: number
  paidSeats: number
  paidThrough: string | null
  accessUntil: string | null
  pastDueSince: string | null
  cancelAtPeriodEnd: boolean
  revoked: boolean
  pendingSeats: number | null
  pendingAt: string | null
}

export const TEAM_MIN_SEATS = 5
export const TEAM_MAX_SEATS = 500
const validSeats = (n: unknown): n is number =>
  Number.isSafeInteger(n) &&
  Number(n) >= TEAM_MIN_SEATS &&
  Number(n) <= TEAM_MAX_SEATS
const dateOrNull = (v: unknown): v is string | null =>
  v === null || (typeof v === "string" && Number.isFinite(Date.parse(v)))
const statuses = new Set([
  "active",
  "past_due",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "unpaid",
  "paused",
  "trialing",
])

function validCoverage(m: PaidTeamMembership) {
  if (m.paidSeats > m.seats || (m.paidSeats > 0 && !validSeats(m.paidSeats)))
    return false
  if (m.pendingSeats !== null && (!validSeats(m.pendingSeats) || !m.pendingAt))
    return false
  if (m.pendingSeats === null && m.pendingAt !== null) return false
  if (!m.accessUntil) return true
  if (
    !m.paidThrough ||
    !m.paidSeats ||
    m.revoked ||
    !["active", "past_due", "canceled"].includes(m.status)
  )
    return false
  const end = Date.parse(m.accessUntil),
    paid = Date.parse(m.paidThrough)
  if (end <= paid) return true

  return (
    m.status === "past_due" &&
    Boolean(m.pastDueSince) &&
    end <=
      Math.min(
        paid + 7 * 86_400_000,
        Date.parse(m.pastDueSince!) + 7 * 86_400_000
      )
  )
}

export function isPaidTeamMembership(
  value: unknown
): value is PaidTeamMembership {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const m = value as Record<string, unknown>
  if (
    !(
      (m.mode === "sandbox" || m.mode === "live") &&
      typeof m.status === "string" &&
      statuses.has(m.status) &&
      typeof m.priceId === "string" &&
      /^price_[\da-z]+$/i.test(m.priceId) &&
      Number.isSafeInteger(m.unitAmount) &&
      Number(m.unitAmount) > 0 &&
      m.currency === "gbp" &&
      validSeats(m.seats) &&
      Number.isSafeInteger(m.paidSeats) &&
      Number(m.paidSeats) >= 0 &&
      (m.pendingSeats === null || validSeats(m.pendingSeats)) &&
      dateOrNull(m.accessUntil) &&
      dateOrNull(m.paidThrough) &&
      dateOrNull(m.pastDueSince) &&
      dateOrNull(m.pendingAt) &&
      typeof m.revoked === "boolean" &&
      typeof m.cancelAtPeriodEnd === "boolean"
    )
  )
    return false

  return validCoverage(value as PaidTeamMembership)
}
