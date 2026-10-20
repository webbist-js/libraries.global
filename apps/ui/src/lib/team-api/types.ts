export const API_SCOPES = ["search:read", "libraries:read"] as const
export type ApiScope = (typeof API_SCOPES)[number]

export type ApiLimits = {
  requests: number
  bytes: number
  perMinute: number
  concurrency: number
  keys: number
  responseBytes: number
}

export type ApiMembership = {
  mode: "sandbox" | "live"
  status: string
  priceId: string
  currency: string
  unitAmount: number
  paidThrough: string | null
  /** First settled API access, retained across renewals. Absent in older snapshots. */
  startedAt?: string | null
  cancelAtPeriodEnd: boolean
  revoked: boolean
  limits: ApiLimits
}

export type ApiKeyView = {
  id: string
  name: string
  prefix: string
  scopes: ApiScope[]
  createdAt: string
  expiresAt: string | null
  lastUsedAt: string | null
  revokedAt: string | null
  requests: number
  bytes: number
}

export type ApiDashboard = {
  teamId: string
  teamName: string
  organiser: boolean
  teamActive: boolean
  membership: ApiMembership | null
  active: boolean
  purchasing: boolean
  price: { unitAmount: number; currency: string } | null
  limits: ApiLimits
  usage: { requests: number; bytes: number; resetsAt: string }
  keys: ApiKeyView[]
  days: { day: string; requests: number; bytes: number; errors: number }[]
  endpoints: {
    endpoint: string
    requests: number
    bytes: number
    errors: number
  }[]
  warnings: ("requests" | "bytes")[]
  pendingPayment: boolean
}
