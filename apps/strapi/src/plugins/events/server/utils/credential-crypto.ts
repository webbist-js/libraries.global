import { decrypt, encrypt } from "@repo/events-crypto"

/**
 * Event Credential values, sealed with AES-256-GCM. The current value is
 * bound (additional authenticated data) to the row's documentId and a
 * pending replacement to `${documentId}:pending`, so a blob copied between
 * rows or slots fails to open. Only Strapi and the sync worker hold the key.
 */
export type Slot = "current" | "pending"

const KEY_ENV = "EVENTS_CREDENTIAL_KEY"
const PREV_KEY_ENV = "EVENTS_CREDENTIAL_KEY_PREV"

function key(): string {
  const k = process.env[KEY_ENV]
  if (!k || k.length !== 64)
    throw new Error(`${KEY_ENV} must be a 64-character hex string`)

  return k
}
function prevKey(): string | undefined {
  const k = process.env[PREV_KEY_ENV]

  return k && k.length === 64 ? k : undefined
}

export const aadFor = (documentId: string, slot: Slot): string =>
  slot === "current" ? documentId : `${documentId}:pending`

export function sealValues(
  values: Record<string, string>,
  documentId: string,
  slot: Slot
): string {
  return encrypt(JSON.stringify(values), key(), {
    aad: aadFor(documentId, slot),
  })
}

export function openValues(
  blob: string,
  documentId: string,
  slot: Slot
): Record<string, string> {
  return JSON.parse(
    decrypt(blob, key(), prevKey(), { aad: aadFor(documentId, slot) })
  ) as Record<string, string>
}
