import { createRequire } from "node:module"

import type { RunLog } from "./run-log"
import type { LibraryCreateData, StrapiClient } from "../../strapi-client"

export interface PreparedLibrary {
  recordId: string
  data: LibraryCreateData & { slug: string }
  warnings: string[]
}

const libraryAttributes = createRequire(__filename)(
  "../../../src/api/library/content-types/library/schema.json"
).attributes

/** Enforce the CMS scalar field limits before any country writes. */
export function validateLibraries(records: PreparedLibrary[]) {
  const recordIds = new Set<string>(),
    slugs = new Set<string>()
  for (const record of records) {
    if (
      !record.recordId ||
      recordIds.has(record.recordId) ||
      slugs.has(record.data.slug)
    )
      throw new Error(`Duplicate library identity or slug ${record.recordId}`)
    recordIds.add(record.recordId)
    slugs.add(record.data.slug)
    if (!record.data.name?.trim() || !record.data.slug?.trim())
      throw new Error(`Missing library name or slug ${record.recordId}`)
    for (const [field, value] of Object.entries(record.data)) {
      const attribute = libraryAttributes[field]
      if (
        attribute &&
        ["string", "uid", "email"].includes(attribute.type) &&
        typeof value === "string" &&
        value.length > (attribute.maxLength ?? 255)
      )
        throw new Error(
          `Library ${record.recordId}: ${field} exceeds the CMS field limit`
        )
    }
  }
}

/** Checkpoint every completed write; after failure stop dispatch and settle in-flight requests. */
export async function importLibraryDrafts<T extends PreparedLibrary>(options: {
  client: StrapiClient
  dataset: string
  records: T[]
  existing: Map<string, string>
  retrievedAt: string
  log: RunLog
  limit: number
  concurrency?: number
  relations: (record: T) => Partial<LibraryCreateData>
}) {
  const { client, records, existing, dataset, log } = options
  const concurrency = options.concurrency ?? 1
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 4)
    throw new Error("Concurrency must be an integer from 1 to 4")
  const pending: T[] = []
  for (const record of records) {
    const known = existing.get(record.recordId)
    if (known)
      log.add({
        recordId: record.recordId,
        name: record.data.name,
        status: "exists",
        documentId: known,
        slug: record.data.slug,
      })
    else if (pending.length < options.limit) pending.push(record)
  }
  let cursor = 0
  let created = 0
  let failure: unknown
  let failed = false
  async function worker() {
    while (!failed) {
      const record = pending[cursor++]
      if (!record) return
      try {
        const entity = await client.createLibrary({
          ...record.data,
          ...options.relations(record),
          source: dataset,
          sourceRecords: [
            {
              dataset,
              role: "origin",
              recordId: record.recordId,
              retrievedAt: options.retrievedAt.slice(0, 10),
              url: record.data.sourceUrl,
            },
          ],
        })
        existing.set(record.recordId, entity.documentId)
        created++
        log.add({
          recordId: record.recordId,
          name: record.data.name,
          status: "created",
          documentId: entity.documentId,
          slug: record.data.slug,
          warnings: record.warnings,
        })
        log.save()
        if (created % 25 === 0) console.log(`Created ${created} library drafts`)
      } catch (error) {
        if (!failed) failure = error
        failed = true
        log.add({
          recordId: record.recordId,
          name: record.data.name,
          status: "error",
          reason: (error as Error).message,
        })
        log.save()
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, pending.length) }, () =>
      worker()
    )
  )
  log.save()
  if (failed) throw failure

  return created
}

export async function checkLibrarySlugs(
  client: StrapiClient,
  records: PreparedLibrary[],
  existing: Map<string, string>
) {
  validateLibraries(records)
  const pending = records.filter((record) => !existing.has(record.recordId))
  // Bound the encoded URL as well as the number of filter operands.
  for (let start = 0; start < pending.length; start += 20) {
    const batch = pending.slice(start, start + 20)
    const collisions = await client.findAll("libraries", {
      filters: { slug: { $in: batch.map((record) => record.data.slug) } },
      fields: ["slug"],
      status: "draft",
    })
    if (collisions.length)
      throw new Error(
        `Library slugs already in use without matching Source Records: ${collisions.map((record) => record.slug).join(", ")}`
      )
  }
}
