import { createHash, timingSafeEqual } from "node:crypto"

import { ATLAS_LIMITS, atlasLocalGeography } from "@repo/shared-data"

import { atlasJson } from "../../../utils/atlas-json"
import { atlasEnabled } from "../../../utils/atlas-outbox"
import {
  atlasArchivePage,
  atlasChanges,
  atlasExportJournal,
  parseAtlasChangeRequest,
} from "../../../utils/atlas-read-store"
import { atlasSourceRows } from "../../../utils/atlas-source"
import { syncLibraryAccessPlanCopy } from "../../../utils/library-access-plan-copy"
import {
  ingestLocalPopulation,
  readLocalPopulation,
} from "../../../utils/local-population-ingest"
import {
  ingestPopulation,
  readPopulationObservations,
  populationVersion,
} from "../../../utils/population-ingest"
import { isValidServiceSecret } from "../../../utils/service-secret"

function authorize(ctx: any): boolean {
  const token = process.env.ATLAS_SERVICE_TOKEN
  const headers = ctx.request?.headers ?? {}
  const provided = headers["x-atlas-token"]
  if (
    !token ||
    typeof provided !== "string" ||
    !isValidServiceSecret(headers["x-service-secret"]) ||
    !timingSafeEqual(
      createHash("sha256").update(token).digest(),
      createHash("sha256").update(provided).digest()
    )
  ) {
    ctx.status = 401
    ctx.body = { error: "Atlas service authentication required" }

    return false
  }
  if (!atlasEnabled()) {
    ctx.status = 503
    ctx.body = { error: "Atlas unavailable" }

    return false
  }

  return true
}
function integer(value: unknown, fallback: number): number {
  if (value === undefined) return fallback
  if (typeof value !== "string" || !/^\d{1,16}$/.test(value))
    throw new RangeError("Invalid source cursor")
  const number = Number(value)
  if (!Number.isSafeInteger(number))
    throw new RangeError("Invalid source cursor")

  return number
}

export default ({ strapi }: { strapi: any }) => ({
  async ingestPopulation(ctx: any) {
    if (!authorize(ctx)) return
    const body = ctx.request.body ?? {}
    if (
      Object.keys(body).some((key) => key !== "dryRun") ||
      (body.dryRun !== undefined && typeof body.dryRun !== "boolean")
    ) {
      ctx.status = 400
      ctx.body = { error: "Invalid population import request" }

      return
    }
    ctx.body = await ingestPopulation(strapi, { dryRun: body.dryRun })
  },
  async syncPlanCopy(ctx: any) {
    if (!authorize(ctx)) return
    if (Object.keys(ctx.request.body ?? {}).length)
      return ctx.badRequest("Plan copy sync takes no parameters")
    ctx.body = await syncLibraryAccessPlanCopy(strapi)
  },
  async localPopulation(ctx: any) {
    if (!authorize(ctx)) return
    if (Object.keys(ctx.query).length)
      return ctx.badRequest("Local metadata takes no query parameters")
    const observations = await readLocalPopulation(strapi)
    ctx.body = {
      geography: atlasLocalGeography,
      observations,
      populationVersion: populationVersion(observations),
    }
  },
  async ingestLocalPopulation(ctx: any) {
    if (!authorize(ctx)) return
    const body = ctx.request.body ?? {}
    if (
      Object.keys(body).some((key) => key !== "dryRun") ||
      (body.dryRun !== undefined && typeof body.dryRun !== "boolean")
    )
      return ctx.badRequest("Invalid local population import")
    ctx.body = await ingestLocalPopulation(strapi, { dryRun: body.dryRun })
  },
  async countries(ctx: any) {
    if (!authorize(ctx)) return
    if (Object.keys(ctx.query).length) {
      ctx.status = 400
      ctx.body = { error: "Country metadata takes no query parameters" }

      return
    }
    const countries = await strapi.documents("api::country.country").findMany({
      status: "published",
      locale: process.env.ATLAS_CANONICAL_LOCALE ?? "en",
      fields: [
        "documentId",
        "iso2",
        "iso3",
        "populationCount",
        "populationYear",
        "populationSource",
        "populationReportingCode",
      ],
      limit: ATLAS_LIMITS.facetValues + 1,
    })
    if (countries.length > ATLAS_LIMITS.facetValues)
      throw new Error("Atlas country catalogue exceeds budget")
    const observations = await readPopulationObservations(strapi)
    ctx.body = {
      countries,
      observations,
      populationVersion: populationVersion(observations),
    }
  },
  async library(ctx: any) {
    if (!authorize(ctx)) return
    const { key, locale } = ctx.query
    if (
      Object.keys(ctx.query).some(
        (field) => !["key", "locale"].includes(field)
      ) ||
      typeof key !== "string" ||
      !/^[\p{L}\p{N}_-]{1,255}$/u.test(key) ||
      (locale !== undefined &&
        (typeof locale !== "string" || !/^[a-zA-Z-]{2,20}$/.test(locale)))
    ) {
      ctx.status = 400
      ctx.body = { error: "Invalid library selection" }

      return
    }
    const canonical = process.env.ATLAS_CANONICAL_LOCALE ?? "en"
    const translated = await strapi
      .documents("api::library.library")
      .findFirst({
        status: "published",
        locale: locale ?? canonical,
        filters: { $or: [{ documentId: key }, { slug: key }] },
        fields: ["documentId"],
      })
    const rows = await atlasSourceRows(
      strapi,
      translated
        ? { documentId: translated.documentId }
        : { $or: [{ documentId: key }, { slug: key }] },
      1,
      canonical
    )
    if (!rows.length) {
      ctx.status = 404
      ctx.body = { error: "Library not found" }

      return
    }
    ctx.body = { source: rows[0].source }
  },
  async exportValidation(ctx: any) {
    if (!authorize(ctx)) return
    try {
      ctx.body = await atlasExportJournal(
        strapi.db.connection,
        ctx.request.body
      )
    } catch (error) {
      if (error instanceof RangeError) {
        ctx.status = 400
        ctx.body = { error: error.message }

        return
      }
      throw error
    }
  },
  async changes(ctx: any) {
    if (!authorize(ctx)) return
    try {
      ctx.body = await atlasChanges(
        strapi.db.connection,
        parseAtlasChangeRequest(ctx.request.body)
      )
    } catch (error) {
      if (error instanceof RangeError) {
        ctx.status = 400
        ctx.body = { error: error.message }

        return
      }
      throw error
    }
  },
  async archive(ctx: any) {
    if (!authorize(ctx)) return
    try {
      if (
        Object.keys(ctx.query).some(
          (key) => !["after", "upper", "limit"].includes(key)
        )
      )
        throw new RangeError("Unknown archive field")
      ctx.body = await atlasArchivePage(
        strapi.db.connection,
        integer(ctx.query.after, 0),
        ctx.query.upper === undefined ? undefined : integer(ctx.query.upper, 0),
        integer(ctx.query.limit, ATLAS_LIMITS.sourceBatch)
      )
    } catch (error) {
      if (error instanceof RangeError) {
        ctx.status = 400
        ctx.body = { error: error.message }

        return
      }
      throw error
    }
  },
  async scan(ctx: any) {
    if (!authorize(ctx)) return
    try {
      if (
        Object.keys(ctx.query).some(
          (key) => !["after", "upper", "limit"].includes(key)
        )
      )
        throw new RangeError("Unknown source field")
      const after = integer(ctx.query.after, 0),
        limit = integer(ctx.query.limit, ATLAS_LIMITS.backfillBatch)
      const locale = process.env.ATLAS_CANONICAL_LOCALE ?? "en"
      const upper =
        ctx.query.upper === undefined
          ? ((
              await strapi.documents("api::library.library").findFirst({
                status: "published",
                locale,
                fields: ["id"],
                sort: "id:desc",
              })
            )?.id ?? 0)
          : integer(ctx.query.upper, 0)
      const rows = await atlasSourceRows(
        strapi,
        { id: { $gt: after, $lte: upper } },
        limit,
        locale
      )
      ctx.body = {
        rows,
        upper,
        next: rows.length === limit ? rows.at(-1)?.id : null,
      }
    } catch (error) {
      if (error instanceof RangeError) {
        ctx.status = 400
        ctx.body = {
          error: error.message,
          code: error.message.includes("overflow")
            ? "ATLAS_SOURCE_WINDOW"
            : "INVALID_ATLAS_SOURCE",
        }

        return
      }
      throw error
    }
  },
  async batch(ctx: any) {
    if (!authorize(ctx)) return
    const body = ctx.request.body
    const ids = body?.documentIds
    if (
      !body ||
      Object.keys(body).some((key) => key !== "documentIds") ||
      !Array.isArray(ids) ||
      ids.length < 1 ||
      ids.length > ATLAS_LIMITS.projectionBatch ||
      ids.some(
        (id) => typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,200}$/.test(id)
      ) ||
      new Set(ids).size !== ids.length
    ) {
      ctx.status = 400
      ctx.body = { error: "Expected 1..200 unique document IDs" }

      return
    }
    try {
      const rows = await atlasSourceRows(
        strapi,
        { documentId: { $in: ids } },
        ids.length,
        process.env.ATLAS_CANONICAL_LOCALE ?? "en"
      )
      const byId = new Map(
        rows.map(({ source }) => [source.documentId, source])
      )
      ctx.body = {
        rows: ids.map((documentId) => ({
          documentId,
          source: byId.get(documentId) ?? null,
        })),
      }
    } catch (error) {
      if (error instanceof RangeError) {
        ctx.status = 400
        ctx.body = {
          error: error.message,
          code: error.message.includes("overflow")
            ? "ATLAS_SOURCE_WINDOW"
            : "INVALID_ATLAS_SOURCE",
        }

        return
      }
      throw error
    }
  },
  async state(ctx: any) {
    if (!authorize(ctx)) return
    const state = await strapi.db
      .connection("atlas_state")
      .where({ key: "current" })
      .first()
    const oldest = await strapi.db
      .connection("atlas_records")
      .where({ active: true })
      .whereNotNull("clock_due")
      .min("clock_due as due")
      .first()
    ctx.body = {
      schemaVersion: 1,
      projectionRevision: String(state.projection_revision),
      indexedThrough: String(state.indexed_through),
      journalFloor: String(state.journal_floor),
      queryEpoch: state.query_epoch,
      canonicalLocale: state.canonical_locale,
      dictionary: atlasJson(state.dictionary),
      manifest: atlasJson(state.manifest),
      heartbeatAt: state.heartbeat_at,
      clockDue: oldest?.due ?? null,
    }
  },
})
