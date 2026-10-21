import "server-only"

import { billingConfig } from "@/lib/billing/config"

export function teamBillingConfig() {
  const billing = billingConfig()

  return {
    ...billing,
    purchasing:
      process.env.TEAM_BILLING_ENABLED === "true" &&
      process.env.STRIPE_MANAGED_PAYMENTS_ENABLED === "true" &&
      billing.configured &&
      Boolean(process.env.STRIPE_PRICE_TEAM_SEAT_ANNUAL),
    seatPrice: process.env.STRIPE_PRICE_TEAM_SEAT_ANNUAL,
    publicSeatPrice: process.env.STRIPE_PRICE_TEAM_PUBLIC_SEAT_ANNUAL,
    portal: process.env.STRIPE_PORTAL_CONFIGURATION_TEAM,
    publicPortal: process.env.STRIPE_PORTAL_CONFIGURATION_TEAM_PUBLIC,
  }
}
