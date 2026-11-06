import { isLibraryEntityRef } from "@repo/shared-data"

import {
  areasWithLibraries,
  countriesWithLibraries,
  isPlaceSlug,
  regionsWithLibraries,
} from "../../../../utils/place-catalogue"
import { isValidServiceSecret } from "../../../../utils/service-secret"
import { teamIsActive } from "../../../../utils/team-access"
import {
  API_LIBRARY_FIELDS,
  API_LIBRARY_POPULATE,
  projectApiLibraries,
} from "../services/api-library-projection"
import { AccessError, isDocumentId } from "../utils/admin"

// Only the application gateway calls these routes. They never trust a user or
// token identity supplied by an external caller, or forward arbitrary queries.
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
        fields: ["status"],
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
      if (!["en", "cs", "es", "fr"].includes(locale))
        throw new AccessError(400, "invalid_locale")
      const limit = Number(ctx.query.limit ?? 50)
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
        throw new AccessError(400, "invalid_limit")
      const after = ctx.query.after
      if (after && (typeof after !== "string" || !isDocumentId(after)))
        throw new AccessError(400, "invalid_cursor")
      // A region is only unique within its country, and an area within its
      // region, so each level requires the one above it.
      const { country, region, area } = ctx.query as Record<string, unknown>
      for (const value of [country, region, area])
        if (value !== undefined && !isPlaceSlug(value))
          throw new AccessError(400, "invalid_place")
      if ((region && !country) || (area && !region))
        throw new AccessError(400, "invalid_place")
      const filters = {
        ...(detail
          ? { entityRef: { $eq: entityRef } }
          : after
            ? { documentId: { $gt: after } }
            : {}),
        ...(country ? { country: { slug: { $eq: country } } } : {}),
        ...(region
          ? {
              region: {
                slug: { $eq: region },
                country: { slug: { $eq: country } },
              },
            }
          : {}),
        ...(area
          ? { area: { slug: { $eq: area }, region: { slug: { $eq: region } } } }
          : {}),
      }
      const rows = await strapi.documents("api::library.library").findMany({
        status: "published",
        locale,
        filters,
        fields: API_LIBRARY_FIELDS,
        sort: "documentId:asc",
        limit: detail ? 1 : limit + 1,
        populate: API_LIBRARY_POPULATE,
      })
      if (detail && !rows.length) throw new AccessError(404, "not_found")
      const page = rows.slice(0, limit)
      const records = await projectApiLibraries(strapi, page)

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
    /**
     * GET /api/places[?country=[&region=]]: countries with published
     * libraries, a country's regions, or a region's areas, with counts.
     */
    places: wrap(async (ctx) => {
      const locale =
        typeof ctx.query.locale === "string" ? ctx.query.locale : "en"
      if (!["en", "cs", "es", "fr"].includes(locale))
        throw new AccessError(400, "invalid_locale")
      const { country, region } = ctx.query as Record<string, unknown>
      for (const value of [country, region])
        if (value !== undefined && !isPlaceSlug(value))
          throw new AccessError(400, "invalid_place")
      if (region && !country) throw new AccessError(400, "invalid_place")
      const options = { locale }
      const meta = { locale }
      if (!country) {
        const countries = await countriesWithLibraries(strapi, options)

        return {
          data: countries.map(({ documentId: _id, ...row }) => row),
          meta: { ...meta, level: "country" },
        }
      }
      if (!region) {
        const found = await regionsWithLibraries(
          strapi,
          country as string,
          options
        )
        if (!found) throw new AccessError(404, "not_found")

        return {
          data: found.regions.map(({ documentId: _id, ...row }) => row),
          meta: { ...meta, level: "region", country },
        }
      }
      const found = await areasWithLibraries(
        strapi,
        country as string,
        region as string,
        options
      )
      if (!found) throw new AccessError(404, "not_found")

      return {
        data: found.areas.map(({ documentId: _id, ...row }) => row),
        meta: { ...meta, level: "area", country, region },
      }
    }),
  }
}
