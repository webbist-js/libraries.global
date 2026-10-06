import { testFeed as realTestFeed } from "@repo/event-providers"
import {
  type EventProviderKey,
  feedHints,
  type FeedTestCode,
  validateFeedValues,
} from "@repo/shared-data"

import { openValues, sealValues, type Slot } from "../utils/credential-crypto"
import { recordCredentialEvent } from "../utils/credential-events"

export const CREDENTIAL_UID = "plugin::events.event-credential"
const LIBRARY_UID = "api::library.library"
const SYNC_COMMAND_UID = "plugin::events.sync-command"

/** Every field a client of this plugin may see. Never the encrypted ones. */
export const CREDENTIAL_PUBLIC_FIELDS = [
  "documentId",
  "provider",
  "label",
  "scope",
  "status",
  "pausedReason",
  "source",
  "hints",
  "pendingHints",
  "pendingSubmissionDocumentId",
  "submissionDocumentId",
  "lastTestedAt",
  "lastTestResult",
  "pendingTestedAt",
  "pendingTestResult",
  "lastVerifiedAt",
  "lastSyncAt",
  "lastSyncStatus",
  "lastErrorCode",
  "lastErrorMessage",
  "consecutiveFailures",
  "createdAt",
  "updatedAt",
] as const

const LIBRARIES_POPULATE = {
  libraries: { fields: ["name", "entityRef", "documentId", "slug"] },
}

const libraryIdsOf = (credential: any): string[] =>
  ((credential?.libraries as any[] | undefined) ?? [])
    .map((l: any) => l?.documentId as string | undefined)
    .filter((id): id is string => typeof id === "string" && id.length > 0)

function checkValues(
  provider: unknown,
  values: unknown
): Record<string, string> {
  const r = validateFeedValues(provider, values)
  if (!r.ok)
    throw Object.assign(new Error(r.error), { status: 400, field: r.field })

  return r.values
}

type Deps = {
  strapi: any
  testFeed?: (
    provider: string,
    values: Record<string, string>
  ) => Promise<{ result: FeedTestCode; detail?: string }>
}

// Belt and suspenders beyond the Document Service's own `fields` filter:
// a value never reaches a caller of this service, even if a future change
// to a query here forgets to list it. `id` (the row's internal numeric key,
// never shown to a client) always comes through: `delete` needs it to scope
// the credential's Events, and real Strapi returns it regardless of `fields`.
function pick(row: any, fields: readonly string[]): any {
  const out: Record<string, unknown> = { id: row.id }
  for (const f of fields) out[f] = row[f]
  out.libraries = row.libraries

  return out
}

export default ({ strapi, testFeed = realTestFeed }: Deps) => {
  const documents = () => strapi.documents(CREDENTIAL_UID)

  async function readOne(documentId: string, extra: string[] = []) {
    const fields = [...CREDENTIAL_PUBLIC_FIELDS, ...extra]
    const row = await documents().findOne({
      documentId,
      fields,
      populate: LIBRARIES_POPULATE,
    })

    return row ? pick(row, fields) : null
  }

  /**
   * Recompute `library.hasActiveFeed` for the given libraries only: one
   * query for the active credentials linked to them, in chunks of 500 ids,
   * then a scalar write on every version of each library (draft and
   * published) without publishing anything else.
   */
  async function syncLibraryFeedFlags(
    libraryDocumentIds: Iterable<string>
  ): Promise<void> {
    const ids = [...new Set(libraryDocumentIds)]
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500)
      const active = (await documents().findMany({
        filters: {
          status: "active",
          libraries: { documentId: { $in: chunk } },
        },
        fields: ["documentId"],
        populate: { libraries: { fields: ["documentId"] } },
        limit: 500 * 5,
      })) as any[]
      const fed = new Set(active.flatMap(libraryIdsOf))
      const on = chunk.filter((id) => fed.has(id))
      const off = chunk.filter((id) => !fed.has(id))
      for (const [value, subset] of [
        [true, on],
        [false, off],
      ] as const) {
        if (subset.length === 0) continue
        await strapi.db.query(LIBRARY_UID).updateMany({
          where: { documentId: { $in: subset } },
          data: { hasActiveFeed: value },
        })
      }
    }
  }

  async function queueSync(
    credentialDocumentId?: string,
    requestedByUserId?: string
  ) {
    await strapi.documents(SYNC_COMMAND_UID).create({
      data: {
        requestedAt: new Date().toISOString(),
        requestedByUserId,
        credentialDocumentId,
      },
    })
  }

  return {
    syncLibraryFeedFlags,
    queueSync,

    /** Strapi admin only: adds who connected each feed (a private field). */
    async findAll() {
      const fields = [...CREDENTIAL_PUBLIC_FIELDS, "connectedBy"]
      const rows = (await documents().findMany({
        fields,
        populate: LIBRARIES_POPULATE,
        sort: ["id:asc"],
        limit: 500,
      })) as any[]

      return rows.map((row) => pick(row, fields))
    },

    findOne: (documentId: string) => readOne(documentId),

    async create(
      data: {
        provider: string
        label: string
        scope: "library" | "group"
        status?: "active" | "paused"
        libraryDocumentIds?: string[]
        credentials: unknown
      },
      actor: string
    ) {
      const values = checkValues(data.provider, data.credentials)
      const provider = data.provider as EventProviderKey
      const libraryDocumentIds = data.libraryDocumentIds ?? []

      return strapi.db.transaction(async () => {
        // The blob is bound to the documentId, which Strapi assigns on
        // create: write a placeholder, then seal under the real id.
        const created = await documents().create({
          data: {
            provider,
            label: data.label.trim().slice(0, 200),
            scope: data.scope,
            status: data.status ?? "active",
            ...(data.status === "paused" ? { pausedReason: "admin" } : {}),
            source: "admin",
            connectedBy: actor,
            credentialsEncrypted: "{}",
            hints: feedHints(provider, values),
            ...(libraryDocumentIds.length
              ? {
                  libraries: libraryDocumentIds.map((documentId) => ({
                    documentId,
                  })),
                }
              : {}),
          },
        })
        await documents().update({
          documentId: created.documentId,
          data: {
            credentialsEncrypted: sealValues(
              values,
              created.documentId,
              "current"
            ),
          },
        })
        await recordCredentialEvent(strapi, {
          credentialDocumentId: created.documentId,
          provider,
          libraryDocumentIds,
          action: "admin_created",
          actor,
        })
        await syncLibraryFeedFlags(libraryDocumentIds)

        return readOne(created.documentId)
      })
    },

    async update(
      documentId: string,
      data: {
        label?: string
        status?: "active" | "paused"
        libraryDocumentIds?: string[]
        credentials?: unknown
      },
      actor: string
    ) {
      const before = await readOne(documentId)
      if (!before) return null
      const patch: Record<string, unknown> = {}
      if (data.label != null) patch.label = data.label.trim().slice(0, 200)
      if (data.status === "active")
        Object.assign(patch, { status: "active", pausedReason: null })
      if (data.status === "paused")
        Object.assign(patch, { status: "paused", pausedReason: "admin" })
      if (data.credentials != null) {
        const values = checkValues(before.provider, data.credentials)
        patch.credentialsEncrypted = sealValues(values, documentId, "current")
        patch.hints = feedHints(before.provider, values)
        patch.consecutiveFailures = 0
      }
      if (data.libraryDocumentIds != null)
        patch.libraries = data.libraryDocumentIds.map((id) => ({
          documentId: id,
        }))

      return strapi.db.transaction(async () => {
        await documents().update({ documentId, data: patch })
        const after = await readOne(documentId)
        await recordCredentialEvent(strapi, {
          credentialDocumentId: documentId,
          provider: before.provider,
          libraryDocumentIds: libraryIdsOf(after),
          action: "admin_updated",
          actor,
          note:
            Object.keys(patch)
              .filter((k) => k !== "credentialsEncrypted")
              .join(", ") +
            (patch.credentialsEncrypted
              ? (Object.keys(patch).length > 1 ? ", " : "") + "values"
              : ""),
        })
        await syncLibraryFeedFlags([
          ...libraryIdsOf(before),
          ...libraryIdsOf(after),
        ])

        return after
      })
    },

    async delete(documentId: string, actor: string) {
      const before = await readOne(documentId)
      if (!before) return null

      return strapi.db.transaction(async () => {
        await strapi.db
          .query("plugin::events.event")
          .deleteMany({ where: { credentialId: before.id } })
        await documents().delete({ documentId })
        await recordCredentialEvent(strapi, {
          credentialDocumentId: documentId,
          provider: before.provider,
          libraryDocumentIds: libraryIdsOf(before),
          action: "admin_deleted",
          actor,
        })
        await syncLibraryFeedFlags(libraryIdsOf(before))

        return before
      })
    },

    /** Tests a stored slot in-process and records the result code. */
    async test(
      documentId: string,
      slot: Slot,
      actor: string
    ): Promise<{ result: FeedTestCode } | null> {
      const row = await documents().findOne({
        documentId,
        fields: [
          "documentId",
          "provider",
          "credentialsEncrypted",
          "pendingCredentialsEncrypted",
        ],
      })
      if (!row) return null
      const blob =
        slot === "current"
          ? row.credentialsEncrypted
          : row.pendingCredentialsEncrypted
      if (!blob) return null
      let outcome: { result: FeedTestCode; detail?: string }
      try {
        outcome = await testFeed(
          row.provider,
          openValues(blob, documentId, slot)
        )
      } catch {
        outcome = { result: "decrypt_failed" }
      }
      const at = new Date().toISOString()
      await documents().update({
        documentId,
        data:
          slot === "current"
            ? { lastTestedAt: at, lastTestResult: outcome.result }
            : { pendingTestedAt: at, pendingTestResult: outcome.result },
      })
      await recordCredentialEvent(strapi, {
        credentialDocumentId: documentId,
        provider: row.provider,
        action: "tested",
        actor,
        resultCode: outcome.result,
        note: slot,
      })

      return { result: outcome.result }
    },

    /** Strapi admin only (`reveal-credentials`); every call is logged. */
    async reveal(
      documentId: string,
      slot: Slot,
      actor: string
    ): Promise<Record<string, string> | null> {
      const row = await documents().findOne({
        documentId,
        fields: [
          "documentId",
          "provider",
          "credentialsEncrypted",
          "pendingCredentialsEncrypted",
        ],
      })
      const blob =
        slot === "current"
          ? row?.credentialsEncrypted
          : row?.pendingCredentialsEncrypted
      if (!row || !blob) return null
      const values = openValues(blob, documentId, slot)
      await recordCredentialEvent(strapi, {
        credentialDocumentId: documentId,
        provider: row.provider,
        action: "revealed",
        actor,
        note: slot,
      })

      return values
    },
  }
}
