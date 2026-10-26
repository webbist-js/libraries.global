import type {
  DocumentStore,
  Identity,
  DocumentRuntime,
} from "../../../../utils/document-store"

export const NETWORK_EVENT = "plugin::access.network-mandate-event"
export type NetworkEvent = Identity & {
  actor: string
  action: "approved" | "reconciled" | "revoked"
  version: number
  submissionDocumentId?: string
  libraryIds: string[]
  ownerLibraryIds?: string[]
  reason?: string
  createdAt: string
}
export function recordNetworkEvent(
  strapi: DocumentRuntime,
  mandateId: string,
  event: Omit<NetworkEvent, "documentId" | "createdAt">
) {
  return (
    strapi.documents(NETWORK_EVENT) as DocumentStore<NetworkEvent>
  ).create({ data: { ...event, mandate: mandateId } })
}
