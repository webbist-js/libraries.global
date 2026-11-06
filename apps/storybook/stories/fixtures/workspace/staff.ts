import type { TeamDetail } from "@/lib/staff/types"
import type { ApiDashboard } from "@/lib/team-api/types"

const limits = {
  requests: 10_000,
  bytes: 262_144_000,
  analysisCredits: 100,
  perMinute: 30,
  concurrency: 2,
  responseBytes: 131_072,
  pageSize: 50,
  keys: null,
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
    unitAmount: 10_000,
    paidThrough: "2099-01-15",
    period: { start: "2098-12-15", end: "2099-01-15" },
    startedAt: "2098-12-15",
    cancelAtPeriodEnd: false,
    revoked: false,
    offer: {
      offerVersion: "2.0",
      priceId: "example-api",
      taxBehavior: "inclusive",
      limits,
      overageRates: { requestPence: 1, mibPence: 10, creditPence: 50 },
      overagePrices: {},
      consentVersion: "2.0",
    },
    overageItems: {},
    limits,
  },
  active: true,
  purchasing: true,
  price: { unitAmount: 10_000, currency: "gbp" },
  limits,
  usage: {
    requests: 1240,
    bytes: 2500000,
    credits: 15,
    resetsAt: "2099-01-15",
    periodStart: "2098-12-15",
  },
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
  overageAvailable: true,
  rates: { requestPence: 1, mibPence: 10, creditPence: 50 },
  overage: { enabled: false, capPence: 10_000, revision: 0, updatedAt: null },
  accrued: { requestsPence: 0, bytesPence: 0, creditsPence: 0, totalPence: 0 },
  projectedInvoicePence: 10_000,
  pendingPayment: false,
}
export const team: TeamDetail = {
  documentId: "example-team",
  name: "Example Library Team",
  slug: "example-library-team",
  status: "active",
  verifiedAt: null,
  expiresAt: null,
  libraries: [],
  members: [],
  viewerRole: "organiser",
  organiserNames: ["Maya S."],
}
export const billingResponses = {
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
  "GET /api/staff/team/libraries": { body: { libraries: team.libraries } },
  "PUT /api/staff/team/example-team": { body: { team } },
}
