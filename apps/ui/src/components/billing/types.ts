import type { PaidMembership, PlanKey, PlanSource } from "@repo/access"

export type BillingPrice = {
  plan: "supporter" | "pro"
  interval: "month" | "year"
  unitAmount: number
  currency: string
}
export type PriceCatalogue = {
  available: boolean
  sandbox: boolean
  prices: BillingPrice[]
}
export type BillingSummary = {
  membership: PaidMembership | null
  effectivePlan: PlanKey
  accessSource: PlanSource
  canManage: boolean
  available: boolean
  confirmationPending?: boolean
  paymentMethod?: {
    brand: string
    last4: string
    expiryMonth: number
    expiryYear: number
    wallet: string | null
  } | null
  billingDetails?: {
    name: string | null
    email: string | null
    postalCode: string | null
  } | null
  foundingPrice?: boolean
  paymentAttention?: boolean
  scheduledChange?: {
    plan: "pro" | "supporter"
    interval: "month" | "year"
    date: number
    unitAmount: number
    currency: string
    canUndo?: boolean
  } | null
  nextAttempt?: { date: number; total: number; currency: string } | null
  invoices: {
    id: string
    number: string | null
    description?: string | null
    created: number
    currency: string
    total: number
    status: string | null
    pdf: string | null
  }[]
}

/** Display uses settlement coverage as well as provider status. */
export function membershipStatusKey(
  membership: PaidMembership,
  now = Date.now()
) {
  if (
    membership.revoked ||
    membership.graceExpired ||
    membership.status === "paused"
  )
    return "suspended"
  if (["past_due", "unpaid"].includes(membership.status))
    return "paymentAttention"
  const covered = Boolean(
    membership.paidThrough && Date.parse(membership.paidThrough) > now
  )
  if (membership.status === "canceled" || membership.cancelAtPeriodEnd)
    return covered ? "renewalStopped" : "membershipEnded"
  if (covered && membership.status === "active") return "active"
  if (
    membership.status === "incomplete_expired" ||
    (membership.paidThrough && !covered)
  )
    return "membershipEnded"

  return "membershipConfirming"
}
export function invoiceStatusKey(status: string | null) {
  switch (status) {
    case "draft":
    case "open":
    case "paid":
    case "uncollectible":
    case "void":
      return status

    default:
      return "unknown"
  }
}
const ZERO_DECIMAL = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
])

export const formatBillingMoney = (
  amount: number,
  currency: string,
  locale: string
) =>
  new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    amount / (ZERO_DECIMAL.has(currency.toLowerCase()) ? 1 : 100)
  )

export const formatBillingDate = (value: string | number, locale: string) =>
  new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
