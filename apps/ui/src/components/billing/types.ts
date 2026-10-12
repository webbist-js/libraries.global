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
  scheduledChange?: {
    plan: "pro" | "supporter"
    interval: "month" | "year"
    date: number
    unitAmount: number
    currency: string
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
