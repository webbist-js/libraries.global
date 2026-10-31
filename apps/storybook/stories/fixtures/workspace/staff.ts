import type { PriceCatalogue } from "@/components/billing/types"
import type { TeamDetail } from "@/lib/staff/types"
import type { ApiDashboard } from "@/lib/team-api/types"
import type { TeamBillingDashboard } from "@/lib/team-billing/types"

export const priceCatalogue: PriceCatalogue = {
  available: true,
  sandbox: true,
  prices: [
    { plan: "supporter", interval: "month", unitAmount: 300, currency: "gbp" },
    { plan: "supporter", interval: "year", unitAmount: 3000, currency: "gbp" },
    { plan: "pro", interval: "month", unitAmount: 800, currency: "gbp" },
    { plan: "pro", interval: "year", unitAmount: 8000, currency: "gbp" },
  ],
}
const limits = {
  requests: 10000,
  bytes: 100000000,
  perMinute: 60,
  concurrency: 4,
  keys: null,
  responseBytes: 1000000,
}

export const apiDashboard: ApiDashboard = {
  teamId: "example-team",
  teamName: "Example Library Team",
  organiser: true,
  teamActive: true,
  membership: {
    mode: "sandbox",
    status: "active",
    priceId: "example-api",
    currency: "gbp",
    unitAmount: 1000,
    paidThrough: "2099-01-15",
    cancelAtPeriodEnd: false,
    revoked: false,
    limits,
  },
  active: true,
  purchasing: true,
  price: { unitAmount: 1000, currency: "gbp" },
  limits,
  usage: { requests: 1240, bytes: 2500000, resetsAt: "2099-01-15" },
  keys: [
    {
      id: "example-key",
      name: "Library directory",
      prefix: "EXAMPLE",
      scopes: ["search:read", "libraries:read"],
      createdAt: "2026-01-15",
      expiresAt: null,
      lastUsedAt: "2026-01-15",
      revokedAt: null,
      requests: 1240,
      bytes: 2500000,
    },
  ],
  days: [{ day: "2026-01-15", requests: 1240, bytes: 2500000, errors: 2 }],
  endpoints: [
    { endpoint: "/v1/libraries", requests: 1240, bytes: 2500000, errors: 2 },
  ],
  warnings: [],
  pendingPayment: false,
}
export const teamBilling: TeamBillingDashboard = {
  teamId: "example-team",
  name: "Example Library Team",
  organiser: true,
  source: "checkout",
  active: true,
  used: 2,
  seats: 5,
  purchasing: true,
  discounted: false,
  mode: "sandbox",
  pending: false,
  synced: true,
  membership: {
    mode: "sandbox",
    status: "active",
    priceId: "example-team-price",
    unitAmount: 1200,
    currency: "gbp",
    seats: 5,
    paidSeats: 5,
    paidThrough: "2099-01-15",
    accessUntil: "2099-01-15",
    pastDueSince: null,
    cancelAtPeriodEnd: false,
    revoked: false,
    pendingSeats: null,
    pendingAt: null,
  },
}
export const team: TeamDetail = {
  documentId: "example-team",
  name: "Example Library Team",
  slug: "example-library-team",
  seats: 5,
  used: 2,
  status: "active",
  verifiedAt: null,
  expiresAt: null,
  libraries: [],
  members: [],
  viewerRole: "organiser",
  organiserNames: ["Maya S."],
}
export const billingResponses = {
  "GET /api/billing/prices": { body: priceCatalogue },
  "GET /api/profile/me": { body: { profile: { username: "example-member" } } },
}

export const staffLibrary = {
  id: "example-library",
  name: "Northbridge Library",
  slug: "northbridge",
  libraryType: "Public",
  role: "owner",
  canGoLive: false,
} as const

export const staffResponses = {
  ...billingResponses,
  "GET /api/staff/example-library/overview": {
    body: {
      library: {
        documentId: "example-library",
        name: "Northbridge Library",
        slug: "northbridge",
        libraryType: "Public",
        path: "/libraries/northbridge",
        completeness: 76,
      },
      role: "owner",
      health: [],
      counts: { suggestions: 3, noticesUpcoming: 1, noticesActive: 1 },
    },
  },
  "GET /api/staff/team/example-team/api": { body: apiDashboard },
  "GET /api/staff/team/example-team/billing": { body: teamBilling },
  "GET /api/staff/team/libraries": { body: { libraries: team.libraries } },
  "PUT /api/staff/team/example-team": { body: { team } },
}
