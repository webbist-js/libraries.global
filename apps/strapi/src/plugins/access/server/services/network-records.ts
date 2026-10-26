import type { Capabilities } from "@repo/access"
import type {
  NetworkClaimSnapshot,
  NetworkFulfilment,
  NetworkKind,
} from "@repo/shared-data"

import type { LibraryRecord } from "./widget-records"
import type {
  DocumentStore,
  Identity,
  DocumentRuntime,
} from "../../../../utils/document-store"

export const NETWORK = "api::library-network.library-network",
  AFFILIATION = "plugin::access.network-affiliation",
  MANDATE = "plugin::access.network-mandate",
  SUBMISSION = "plugin::content-moderation.submission"
export type NetworkRecord = Identity & {
  name: string
  slug: string
  kind: NetworkKind
  description?: string
  website?: string
  sourceUrl?: string
  lastVerifiedAt?: string
  publicPageEnabled?: boolean
  publicPageReviewedAt?: string
  countries?: (Identity & {
    name: string
    slug: string
    continent?: { slug: string }
  })[]
}
export type AffiliationRecord = Identity & {
  baUserId: string
  network: NetworkRecord
  role: string
  department: string
  publicDisplay: boolean
  status: "declared" | "pending" | "verified" | "revoked"
  revokedAt?: string | null
  verifiedAt?: string | null
  submissionDocumentId?: string
}
export type MandateRecord = Identity & {
  ownerLibraryIds?: string[]
  staffRole?: "editor" | "owner"
  baUserId: string
  network: NetworkRecord
  team?: Identity | null
  status: "approved" | "revoked"
  approvedLibraryIds: string[]
  sourceLibraryIds?: string[]
  membershipRevision: string
  version: number
  fulfilment: NetworkFulfilment
  reviewedAt?: string
  submissionDocumentId: string
}
export type SubmissionRecord = Identity & {
  contentLocale?: string
  submittedByUserId: string
  submittedByEmail: string
  submissionType: string
  targetDocumentId: string
  fields: NetworkClaimSnapshot
  status: string
  payloadHash?: string
  reviewNote?: string
  resultDocumentId?: string
  createdAt?: string
}
export type NetworkUser = { id: string; email: string; name?: string }
type ModerationService = {
  resubmitNetwork: (
    id: string,
    userId: string,
    fields: Record<string, unknown>,
    locale?: unknown
  ) => Promise<SubmissionRecord | null>
  updateStatus: (
    id: string,
    status: string,
    reviewer: { id: string; kind: "system"; email: null; baUserId: null },
    note: string,
    opts?: { expectedPayloadHash?: string }
  ) => Promise<unknown>
  create: (data: Record<string, unknown>) => Promise<SubmissionRecord>
  loadCapabilities: (id: string) => Promise<{ caps: Capabilities }>
}

export type NetworkRuntime = DocumentRuntime & {
  plugin: (name: string) => { service: (name: string) => ModerationService }
  log: { warn: (message: string, error?: unknown) => void }
}
export function networkStore<Row>(strapi: DocumentRuntime, uid: string) {
  return strapi.documents(uid) as DocumentStore<Row>
}
export const networkLibraries = (strapi: DocumentRuntime) =>
  networkStore<LibraryRecord>(strapi, "api::library.library")
export const networkPopulate = {
  countries: {
    fields: ["name", "slug"],
    populate: { continent: { fields: ["slug"] } },
  },
}
export const publicNetworkFilter = {
  publicPageEnabled: true,
  publicPageReviewedAt: { $notNull: true },
}
