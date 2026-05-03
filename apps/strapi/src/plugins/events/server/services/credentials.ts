import { encrypt, decrypt } from "@repo/events-crypto"

const KEY_ENV = "EVENTS_CREDENTIAL_KEY"
const PREV_KEY_ENV = "EVENTS_CREDENTIAL_KEY_PREV"

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

export function encryptCredentials(plain: Record<string, string>): string {
  return encrypt(JSON.stringify(plain), getKey())
}

export function decryptCredentials(blob: string): Record<string, string> {
  return JSON.parse(decrypt(blob, getKey(), getPrevKey())) as Record<
    string,
    string
  >
}

export default ({ strapi }: { strapi: any }) => ({
  async findAll() {
    return strapi.documents("plugin::events.event-credential").findMany({
      populate: { libraries: { fields: ["id", "name", "entityRef"] } },
    })
  },

  async findOne(documentId: string) {
    return strapi.documents("plugin::events.event-credential").findOne({
      documentId,
      populate: { libraries: { fields: ["id", "name", "entityRef"] } },
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
    const credentialsEncrypted = encryptCredentials(data.credentials)

    return strapi.documents("plugin::events.event-credential").create({
      data: {
        provider: data.provider,
        label: data.label,
        scope: data.scope,
        isActive: data.isActive,
        credentialsEncrypted,
        ...(data.libraryDocumentIds?.length
          ? {
              libraries: data.libraryDocumentIds.map((id) => ({
                documentId: id,
              })),
            }
          : {}),
      },
    })
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
    const patch: Record<string, unknown> = {}
    if (data.label != null) patch.label = data.label
    if (data.isActive != null) patch.isActive = data.isActive
    if (data.credentials != null) {
      patch.credentialsEncrypted = encryptCredentials(data.credentials)
    }
    if (data.libraryDocumentIds != null) {
      patch.libraries = data.libraryDocumentIds.map((id) => ({
        documentId: id,
      }))
    }

    return strapi
      .documents("plugin::events.event-credential")
      .update({ documentId, data: patch })
  },

  async delete(documentId: string) {
    return strapi
      .documents("plugin::events.event-credential")
      .delete({ documentId })
  },

  async getDecryptedCredentials(
    documentId: string
  ): Promise<Record<string, string>> {
    const doc = await strapi
      .documents("plugin::events.event-credential")
      .findOne({
        documentId,
        fields: ["credentialsEncrypted"],
      })
    if (!doc) throw new Error(`Credential ${documentId} not found`)
    if (!doc.credentialsEncrypted) {
      throw new Error(`Credential ${documentId} has no encrypted payload`)
    }

    return decryptCredentials(doc.credentialsEncrypted as string)
  },
})
