import { isLibraryEntityRef, libraryTypeName } from "@repo/shared-data"

import { isValidServiceSecret } from "../../../../utils/service-secret"
import { teamIsActive } from "../../../../utils/team-access"
import { AccessError, isDocumentId } from "../utils/admin"

// Only the application gateway calls these routes. They never trust a user or
// token identity supplied by an external caller, or forward arbitrary queries.
const FIELDS = [
  "name",
  "slug",
  "entityRef",
  "shortName",
  "summary",
  "operationalStatus",
  "operatorType",
  "streetAddress",
  "city",
  "postalCode",
  "location",
  "timezone",
  "website",
  "phone",
  "email",
  "catalogueUrl",
  "updatedAt",
]
const SOURCE_FIELDS = [
  "dataset",
  "recordId",
  "retrievedAt",
  "url",
  "label",
  "role",
  "fields",
]
const DATASET_FIELDS = [
  "key",
  "publisher",
  "licence",
  "licenceUrl",
  "attribution",
  "redistribution",
  "licenceStatus",
]
const pick = (row: any, fields: string[]) =>
  Object.fromEntries(fields.map((field) => [field, row?.[field] ?? null]))

export default ({ strapi }: { strapi: any }) => {
  const wrap = (work: (ctx: any) => Promise<unknown>) => async (ctx: any) => {
    if (!isValidServiceSecret(ctx.request.header["x-service-secret"]))
      return ctx.unauthorized("Invalid service secret")
    ctx.set("Cache-Control", "no-store")
    try {
      ctx.body = await work(ctx)
    } catch (error) {
      if (!(error instanceof AccessError)) throw error
      ctx.status = error.status
      ctx.body = { error: { code: error.code } }
    }
  }

  return {
    status: wrap(async (ctx) => {
      if (!isDocumentId(ctx.params.id)) throw new AccessError(404, "not_found")
      const team = await strapi.documents("plugin::access.team").findOne({
        documentId: ctx.params.id,
        fields: ["status", "expiresAt", "source", "billingMode"],
      })
      if (!team) throw new AccessError(404, "not_found")

      const creator = ctx.request.header["x-api-key-owner"]
      let creatorAllowed: boolean | undefined
      if (creator !== undefined) {
        creatorAllowed = false
        if (
          typeof creator === "string" &&
          creator.length > 0 &&
          creator.length <= 200
        ) {
          const member = await strapi.db
            .query("plugin::access.team-member")
            .findOne({
              where: {
                team: { documentId: ctx.params.id },
                baUserId: creator,
                status: "active",
                teamRole: "organiser",
              },
            })
          creatorAllowed = Boolean(member)
        }
      }

      return {
        active: teamIsActive(team),
        ...(creatorAllowed === undefined ? {} : { creatorAllowed }),
      }
    }),
    libraries: wrap(async (ctx) => {
      const { entityRef } = ctx.params
      const detail = entityRef !== undefined
      if (detail && !isLibraryEntityRef(entityRef))
        throw new AccessError(404, "not_found")
      const locale =
        typeof ctx.query.locale === "string" ? ctx.query.locale : "en"
      if (!["en", "cs", "fr"].includes(locale))
        throw new AccessError(400, "invalid_locale")
      const limit = Number(ctx.query.limit ?? 50)
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
        throw new AccessError(400, "invalid_limit")
      const after = ctx.query.after
      if (after && (typeof after !== "string" || !isDocumentId(after)))
        throw new AccessError(400, "invalid_cursor")
      const filters = {
        ...(detail
          ? { entityRef: { $eq: entityRef } }
          : after
            ? { documentId: { $gt: after } }
            : {}),
        ...(ctx.query.country ? { country: { slug: ctx.query.country } } : {}),
      }
      const rows = await strapi.documents("api::library.library").findMany({
        status: "published",
        locale,
        filters,
        fields: FIELDS,
        sort: "documentId:asc",
        limit: detail ? 1 : limit + 1,
        populate: {
          libraryType: { fields: ["name"] },
          country: { fields: ["name", "slug", "iso2"] },
          region: { fields: ["name", "slug"] },
          sourceRecords: true,
        },
      })
      if (detail && !rows.length) throw new AccessError(404, "not_found")
      const page = rows.slice(0, limit)
      const datasetKeys = [
        ...new Set(
          page.flatMap((row: any) =>
            (row.sourceRecords ?? [])
              .map((source: any) => source.dataset)
              .filter(Boolean)
          )
        ),
      ]
      const datasets = datasetKeys.length
        ? await strapi.documents("api::dataset.dataset").findMany({
            filters: { key: { $in: datasetKeys } },
            fields: DATASET_FIELDS,
            limit: 100,
          })
        : []
      const credits = new Map(
        datasets.map((dataset: any) => [
          dataset.key,
          pick(dataset, DATASET_FIELDS),
        ])
      )
      const records = page.map((row: any) => ({
        documentId: row.documentId,
        ...pick(row, FIELDS),
        libraryType: libraryTypeName(row.libraryType),
        country: row.country
          ? pick(row.country, ["name", "slug", "iso2"])
          : null,
        region: row.region ? pick(row.region, ["name", "slug"]) : null,
        sourceRecords: (row.sourceRecords ?? []).map((source: any) => ({
          ...pick(source, SOURCE_FIELDS),
          datasetCredit: credits.get(source.dataset) ?? null,
        })),
      }))

      return {
        data: detail ? records[0] : records,
        meta: {
          locale,
          nextCursor:
            !detail && rows.length > limit ? page.at(-1).documentId : null,
          attribution:
            "Libraries Global contributors. Imported details retain their source licence; see sourceRecords.",
        },
      }
    }),
  }
}
