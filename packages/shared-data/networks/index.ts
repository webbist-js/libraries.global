import { widgetId, widgetObject, widgetText } from "../widgets"

export const NETWORK_KINDS = [
  "library_service",
  "university_system",
  "consortium",
] as const
export type NetworkKind = (typeof NETWORK_KINDS)[number]
export const NETWORK_KIND_LABELS: Record<NetworkKind, string> = {
  library_service: "Library service",
  university_system: "University system",
  consortium: "Consortium",
}
export const NETWORK_LIMITS = {
  libraries: 2000,
  affiliations: 10,
  openClaims: 5,
  batch: 25,
} as const
export const networkHref = (slug: string) =>
  `/library-networks/${encodeURIComponent(slug)}`
export type NetworkSummary = {
  documentId: string
  name: string
  slug: string
  kind: NetworkKind
  description: string
  website: string | null
  sourceUrl: string | null
  lastVerifiedAt: string | null
  countries: {
    documentId: string
    name: string
    slug: string
    continentSlug: string | null
  }[]
  libraryCount: number
}
export type NetworkAffiliation = {
  documentId: string
  network: Pick<NetworkSummary, "documentId" | "name" | "slug" | "kind">
  role: string
  department: string
  publicDisplay: boolean
  status: "declared" | "pending" | "verified" | "revoked"
  verifiedAt: string | null
}
export type NetworkRequest = {
  staffRole: "editor" | "owner"
  intent: "employment" | "management"
  role: string
  department: string
  note: string
  evidenceUrl: string
  libraryIds: string[]
  teamId: string | null
  mandateId: string | null
}
export type NetworkClaimSnapshot = NetworkRequest & {
  schemaVersion: 1
  networkId: string
  networkName: string
  networkKind: NetworkKind
  membershipRevision: string
  sourceLibraryIds: string[]
  submittedAt: string
}
export type NetworkFulfilment = {
  pending: string[]
  applied: string[]
  failures: Record<string, { attempts: number; message: string }>
  complete: boolean
  revocations?: string[]
}
export type NetworkMandate = {
  staffRole: "editor" | "owner"
  ownerLibraryIds: string[]
  documentId: string
  network: Pick<NetworkSummary, "documentId" | "name" | "slug" | "kind">
  status: "approved" | "revoked"
  approvedLibraryIds: string[]
  additionsAwaitingReview: string[]
  removalsAwaitingReview: string[]
  version: number
  teamId: string | null
  fulfilment: NetworkFulfilment
  reviewedAt: string | null
}
export function parseNetworkRequest(value: unknown): NetworkRequest {
  const input = widgetObject(value)
  if (input.intent !== "employment" && input.intent !== "management")
    throw new RangeError("Choose employment verification or management access")
  const libraryIds = Array.isArray(input.libraryIds)
    ? [...new Set(input.libraryIds.map(widgetId))]
    : []
  if (libraryIds.length > NETWORK_LIMITS.libraries)
    throw new RangeError("Narrow the requested service scope")
  const evidenceUrl = widgetText(input.evidenceUrl ?? "", 2000)
  if (evidenceUrl) {
    const url = new URL(evidenceUrl)
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new RangeError("Use a public institutional evidence URL")
  }
  if (
    input.staffRole !== undefined &&
    input.staffRole !== "editor" &&
    input.staffRole !== "owner"
  )
    throw new RangeError("Choose editor or owner responsibility")

  return {
    staffRole: input.staffRole === "owner" ? "owner" : "editor",
    intent: input.intent,
    role: widgetText(input.role, 160, true),
    department: widgetText(input.department ?? "", 160),
    note: widgetText(input.note, 4000, true),
    evidenceUrl,
    libraryIds,
    teamId: input.teamId ? widgetId(input.teamId) : null,
    mandateId: input.mandateId ? widgetId(input.mandateId) : null,
  }
}
