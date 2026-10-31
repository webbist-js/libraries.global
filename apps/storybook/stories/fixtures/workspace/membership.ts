import type { BillingSummary } from "@/components/billing/types"
import type { MembershipBillingController } from "@/components/membership/useMembershipBilling"
import { fn } from "storybook/test"

import { profileResponses } from "./profile"
import { billingResponses } from "./staff"

export const billingSummary: BillingSummary = {
  membership: {
    mode: "sandbox",
    plan: "pro",
    status: "active",
    interval: "month",
    currency: "gbp",
    unitAmount: 800,
    memberSince: "2026-01-01T12:00:00Z",
    periodEnd: "2099-01-15T12:00:00Z",
    paidThrough: "2099-01-15T12:00:00Z",
    pastDueSince: null,
    cancelAtPeriodEnd: false,
    revoked: false,
  },
  effectivePlan: "pro",
  accessSource: "paid",
  canManage: true,
  available: true,
  confirmationPending: false,
  paymentMethod: {
    brand: "visa",
    last4: "4242",
    expiryMonth: 1,
    expiryYear: 2099,
    wallet: null,
  },
  billingDetails: {
    name: "Maya Example",
    email: "maya@example.invalid",
    postalCode: "EX1 1AA",
  },
  invoices: [
    {
      id: "example-invoice",
      number: "EXAMPLE-001",
      created: 1767268800,
      currency: "gbp",
      total: 800,
      status: "paid",
      pdf: null,
    },
  ],
}
export const billingController: MembershipBillingController = {
  summary: billingSummary,
  error: false,
  busy: false,
  reload: fn(),
  manage: fn(async () => {}),
  undo: fn(async () => {}),
}
export const membershipResponses = {
  ...billingResponses,
  ...profileResponses,
  "GET /api/billing/summary": { body: billingSummary },
  "POST /api/billing/undo-change": { body: { ok: true } },
  "PATCH /api/profile/me": { body: { ok: true } },
}
