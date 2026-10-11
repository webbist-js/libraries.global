/**
 * dataset controller
 */

import { factories } from "@strapi/strapi"

const UID = "api::dataset.dataset"

// The provenance fields a record page shows. Never notes, which may hold
// internal correspondence about a licence.
const PUBLIC_FIELDS = [
  "key",
  "name",
  "publisher",
  "sourceUrl",
  "licence",
  "licenceUrl",
  "licenceStatus",
  "redistribution",
  "attribution",
  "coverage",
  "obtainedAt",
  "sourceUpdatedAt",
] as const

export default factories.createCoreController(UID, ({ strapi }) => ({
  // ── /datasets/by-key/:key ─────────────────────────────────────────────────
  // The Dataset a library's sourceRecords entry points at, for its public credit.
  async byKey(ctx) {
    const { key } = ctx.params as { key: string }
    const results = await strapi.documents(UID).findMany({
      filters: { key: { $eq: key.trim().toLowerCase() } } as Record<
        string,
        unknown
      >,
      fields: [...PUBLIC_FIELDS],
      limit: 1,
    })

    ctx.body = { data: results[0] ?? null, meta: {} }
  },
}))
