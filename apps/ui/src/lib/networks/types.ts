import type {
  NetworkAffiliation,
  NetworkClaimSnapshot,
  NetworkMandate,
  NetworkSummary,
  WidgetLibrary,
} from "@repo/shared-data"

export type NetworkList = {
  countries?: { name: string; slug: string }[]
  regions?: { name: string; slug: string }[]
  networks: NetworkSummary[]
  total: number
  page: number
  pageSize: number
}
export type NetworkDetail = {
  network: NetworkSummary
  total?: number
  facets?: {
    countries: { name: string; slug: string }[]
    regions: { name: string; slug: string }[]
    types: string[]
  }
  libraries: WidgetLibrary[]
  page: number
  pageSize: number
}
export type NetworkWorkspace = {
  affiliations: NetworkAffiliation[]
  mandates: NetworkMandate[]
  requests: {
    documentId: string
    status: string
    fields: NetworkClaimSnapshot
    reviewNote?: string
    resultDocumentId?: string
  }[]
}
export type NetworkReview = {
  libraryNames: Record<string, string>
  audit: {
    documentId: string
    action: string
    version: number
    reason?: string
    createdAt: string
  }[]
  snapshot: NetworkClaimSnapshot
  currentLibraryIds: string[]
  added: string[]
  removed: string[]
  mandates: NetworkMandate[]
}
