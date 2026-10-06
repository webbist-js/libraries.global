/**
 * The Event Feed audit log (`plugin::events.credential-event`): append-only,
 * no REST routes, never a value. Written inside the caller's transaction
 * when there is one, so a rolled-back action leaves no entry.
 */
export const CREDENTIAL_EVENT_UID = "plugin::events.credential-event"

export type CredentialAction =
  | "connect_submitted"
  | "replace_submitted"
  | "approved"
  | "rejected"
  | "withdrawn"
  | "tested"
  | "paused"
  | "resumed"
  | "auto_paused"
  | "disconnected"
  | "revealed"
  | "admin_created"
  | "admin_updated"
  | "admin_deleted"

export async function recordCredentialEvent(
  strapi: any,
  e: {
    credentialDocumentId: string
    provider?: string
    libraryDocumentIds?: string[]
    action: CredentialAction
    actor: string
    submissionDocumentId?: string
    resultCode?: string
    note?: string
  }
): Promise<void> {
  await strapi.documents(CREDENTIAL_EVENT_UID).create({
    data: { ...e, note: e.note?.slice(0, 255) },
  })
}
