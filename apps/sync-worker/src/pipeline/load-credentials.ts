// apps/sync-worker/src/pipeline/load-credentials.ts
import type { LibraryHint } from "@repo/event-providers"
import { decrypt } from "@repo/events-crypto"
import type { EventProviderKey } from "@repo/shared-data"

import db from "../db"
import type { LoadedCredential } from "../types"

function getKey(): string {
  const key = process.env.EVENTS_CREDENTIAL_KEY
  if (!key || key.length !== 64)
    throw new Error("EVENTS_CREDENTIAL_KEY must be a 64-char hex string")

  return key
}

function getPrevKey(): string | undefined {
  const k = process.env.EVENTS_CREDENTIAL_KEY_PREV

  return k && k.length === 64 ? k : undefined
}

interface CredentialRow {
  id: number
  documentId: string
  provider: string
  label: string
  scope: string
  credentialsEncrypted: string
}

type LibraryLinkRow = LibraryHint & { credentialId: number }

/** The linked libraries of every credential in `ids`, grouped by credential, in one query. */
async function loadLibraryHints(
  ids: number[]
): Promise<Map<number, LibraryHint[]>> {
  const byCredential = new Map<number, LibraryHint[]>()
  if (ids.length === 0) return byCredential

  // Strapi v5 manyToMany join table naming: {collectionName}_{field}_lnk
  const rows = (await db("ev_event_credentials_libraries_lnk as lnk")
    .join("libraries as l", "l.id", "lnk.library_id")
    .select(
      "lnk.event_credential_id as credentialId",
      "l.id",
      "l.document_id as documentId",
      "l.entity_ref as entityRef",
      "l.name"
    )
    .whereIn("lnk.event_credential_id", ids)) as LibraryLinkRow[]

  for (const { credentialId, ...hint } of rows) {
    const list = byCredential.get(credentialId) ?? []
    list.push(hint)
    byCredential.set(credentialId, list)
  }

  return byCredential
}

export async function loadCredentials(): Promise<LoadedCredential[]> {
  const rows = (await db("ev_event_credentials as ec")
    .select(
      "ec.id",
      "ec.document_id as documentId",
      "ec.provider",
      "ec.label",
      "ec.scope",
      "ec.credentials_encrypted as credentialsEncrypted"
    )
    .where("ec.status", "active")) as CredentialRow[]

  const key = getKey()
  const prevKey = getPrevKey()
  const hints = await loadLibraryHints(rows.map((r) => r.id))
  const results: LoadedCredential[] = []

  for (const row of rows) {
    let credentials: Record<string, string>
    try {
      // The blob is bound (AAD) to the credential's documentId.
      credentials = JSON.parse(
        decrypt(row.credentialsEncrypted, key, prevKey, { aad: row.documentId })
      ) as Record<string, string>
    } catch {
      console.error(
        `[load-credentials] Failed to decrypt credential ${row.id} ("${row.label}") — skipping`
      )
      continue
    }

    results.push({
      id: row.id,
      documentId: row.documentId,
      provider: row.provider as EventProviderKey,
      label: row.label,
      scope: row.scope as "library" | "group",
      isActive: true,
      credentials,
      libraries: hints.get(row.id) ?? [],
    })
  }

  return results
}
