import { encrypt, decrypt } from "@repo/events-crypto"

const KEY_ENV = "EVENTS_CREDENTIAL_KEY"
const PREV_KEY_ENV = "EVENTS_CREDENTIAL_KEY_PREV"

const CREDENTIAL_UID = "plugin::events.event-credential"
const LIBRARY_UID = "api::library.library"

function getKey(): string {
  const key = process.env[KEY_ENV]
  if (!key || key.length !== 64) {
    throw new Error(`${KEY_ENV} must be a 64-character hex string`)
  }

  return key
}

function getPrevKey(): string | undefined {
  const k = process.env[PREV_KEY_ENV]

  return k && k.length === 64 ? k : undefined
}

/**
 * The stored blob is bound (GCM AAD) to the credential's documentId, so a
 * blob copied between rows in the database fails to decrypt.
 */
export function encryptCredentials(
  plain: Record<string, string>,
  credentialDocumentId: string
): string {
  return encrypt(JSON.stringify(plain), getKey(), { aad: credentialDocumentId })
}

export function decryptCredentials(
  blob: string,
  credentialDocumentId: string
): Record<string, string> {
  return JSON.parse(
    decrypt(blob, getKey(), getPrevKey(), { aad: credentialDocumentId })
  ) as Record<string, string>
}

const LIBRARIES_POPULATE = {
  libraries: { fields: ["id", "name", "entityRef", "documentId"] },
}

const libraryIdsOf = (credential: any): string[] =>
  ((credential?.libraries as any[] | undefined) ?? [])
    .map((l: any) => l?.documentId as string | undefined)
    .filter((id): id is string => typeof id === "string" && id.length > 0)

/**
 * Recompute `library.hasActiveFeed` for the given libraries from the active
 * credentials that remain linked to them, and write the result to every
 * version of each library (draft and published) without publishing anything
 * else: a scalar flag written through `db.query.updateMany` on the
 * documentId reaches both rows, whereas a Document Service `update` would
 * touch the draft only, and publishing it would also push unrelated
 * pending draft changes live.
 */
async function syncLibraryFeedFlags(
  strapi: any,
  libraryDocumentIds: Iterable<string>
): Promise<void> {
  const ids = [...new Set(libraryDocumentIds)]
  if (ids.length === 0) return

  const active = (await strapi.documents(CREDENTIAL_UID).findMany({
    filters: { isActive: true },
    fields: ["documentId"],
    populate: { libraries: { fields: ["documentId"] } },
    sort: ["id:asc"],
    limit: 5000,
  })) as any[]
  const fed = new Set(active.flatMap(libraryIdsOf))

  const on = ids.filter((id) => fed.has(id))
  const off = ids.filter((id) => !fed.has(id))
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

export default ({ strapi }: { strapi: any }) => ({
  async findAll() {
    return strapi.documents(CREDENTIAL_UID).findMany({
      populate: LIBRARIES_POPULATE,
      sort: ["id:asc"],
      limit: 5000,
    })
  },

  async findOne(documentId: string) {
    return strapi.documents(CREDENTIAL_UID).findOne({
      documentId,
      populate: LIBRARIES_POPULATE,
    })
  },

  async create(data: {
    provider: string
    label: string
    scope: string
    isActive: boolean
    libraryDocumentIds?: string[]
    credentials: Record<string, string>
  }) {
    // The blob's AAD is the documentId, which Strapi assigns on create; so
    // the row is created with a blob bound to a placeholder and rebound to
    // its real documentId right after. (`@paralleldrive/cuid2` isn't a
    // dependency of the Strapi app, so the id can't be minted up front.)
    const created = await strapi.documents(CREDENTIAL_UID).create({
      data: {
        provider: data.provider,
        label: data.label,
        scope: data.scope,
        isActive: data.isActive,
        credentialsEncrypted: encryptCredentials(data.credentials, "pending"),
        ...(data.libraryDocumentIds?.length
          ? {
              libraries: data.libraryDocumentIds.map((id) => ({
                documentId: id,
              })),
            }
          : {}),
      },
    })

    const result = await strapi.documents(CREDENTIAL_UID).update({
      documentId: created.documentId,
      data: {
        credentialsEncrypted: encryptCredentials(
          data.credentials,
          created.documentId
        ),
      },
      populate: LIBRARIES_POPULATE,
    })

    if (data.libraryDocumentIds?.length) {
      await syncLibraryFeedFlags(strapi, data.libraryDocumentIds)
    }

    return result ?? created
  },

  async update(
    documentId: string,
    data: {
      label?: string
      isActive?: boolean
      libraryDocumentIds?: string[]
      credentials?: Record<string, string>
    }
  ) {
    const before = await strapi.documents(CREDENTIAL_UID).findOne({
      documentId,
      populate: { libraries: { fields: ["documentId"] } },
    })
    // Captured before the write: the libraries this credential fed until now.
    const previousLibraryIds = libraryIdsOf(before)

    const patch: Record<string, unknown> = {}
    if (data.label != null) patch.label = data.label
    if (data.isActive != null) patch.isActive = data.isActive
    if (data.credentials != null) {
      patch.credentialsEncrypted = encryptCredentials(
        data.credentials,
        documentId
      )
    }
    if (data.libraryDocumentIds != null) {
      patch.libraries = data.libraryDocumentIds.map((id) => ({
        documentId: id,
      }))
    }

    const result = await strapi.documents(CREDENTIAL_UID).update({
      documentId,
      data: patch,
      populate: LIBRARIES_POPULATE,
    })

    // Every library this credential fed before or feeds now gets its flag
    // recomputed, so activating, deactivating and re-linking all converge.
    await syncLibraryFeedFlags(strapi, [
      ...previousLibraryIds,
      ...libraryIdsOf(result),
      ...(data.libraryDocumentIds ?? []),
    ])

    return result
  },

  async delete(documentId: string) {
    const before = await strapi.documents(CREDENTIAL_UID).findOne({
      documentId,
      populate: { libraries: { fields: ["documentId"] } },
    })
    const previousLibraryIds = libraryIdsOf(before)
    const removed = await strapi
      .documents(CREDENTIAL_UID)
      .delete({ documentId })
    await syncLibraryFeedFlags(strapi, previousLibraryIds)

    return removed
  },

  async getDecryptedCredentials(
    documentId: string
  ): Promise<Record<string, string>> {
    const doc = await strapi.documents(CREDENTIAL_UID).findOne({
      documentId,
      fields: ["credentialsEncrypted"],
    })
    if (!doc) throw new Error(`Credential ${documentId} not found`)
    if (!doc.credentialsEncrypted) {
      throw new Error(`Credential ${documentId} has no encrypted payload`)
    }

    return decryptCredentials(doc.credentialsEncrypted as string, documentId)
  },
})
