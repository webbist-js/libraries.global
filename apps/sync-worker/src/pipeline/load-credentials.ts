// apps/sync-worker/src/pipeline/load-credentials.ts
import { decrypt } from "@repo/events-crypto"

import db from "../db"
import type {
  LoadedCredential,
  LibraryHint,
  ProviderKey,
} from "../providers/types"

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

export async function loadCredentials(): Promise<LoadedCredential[]> {
  // Fetch credentials with their linked libraries via the join table.
  // Strapi v5 manyToMany join table naming: {collectionName}_{field}_lnk
  const rows = await db("ev_event_credentials as ec")
    .select(
      "ec.id",
      "ec.document_id as documentId",
      "ec.provider",
      "ec.label",
      "ec.scope",
      "ec.is_active as isActive",
      "ec.credentials_encrypted as credentialsEncrypted"
    )
    .where("ec.is_active", true)

  const key = getKey()
  const prevKey = getPrevKey()
  const results: LoadedCredential[] = []

  for (const row of rows) {
    // Fetch linked libraries from join table
    const libraryRows = await db("ev_event_credentials_libraries_lnk as lnk")
      .join("libraries as l", "l.id", "lnk.library_id")
      .select(
        "l.id",
        "l.document_id as documentId",
        "l.entity_ref as entityRef",
        "l.name"
      )
      .where("lnk.event_credential_id", row.id)

    let credentials: Record<string, string>
    try {
      credentials = JSON.parse(
        decrypt(row.credentialsEncrypted as string, key, prevKey)
      ) as Record<string, string>
    } catch {
      console.error(
        `[load-credentials] Failed to decrypt credential ${row.id} ("${row.label}") — skipping`
      )
      continue
    }

    results.push({
      id: row.id as number,
      documentId: row.documentId as string,
      provider: row.provider as ProviderKey,
      label: row.label as string,
      scope: row.scope as "library" | "group",
      isActive: true,
      credentials,
      libraries: libraryRows as LibraryHint[],
    })
  }

  return results
}
