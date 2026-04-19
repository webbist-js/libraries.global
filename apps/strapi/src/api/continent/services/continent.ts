import { factories } from "@strapi/strapi"

const HOMEPAGE_CONTINENT_ORDER = [
  "europe",
  "asia",
  "africa",
  "north-america",
  "south-america",
  "oceania",
  // Legacy / alternate slugs still map correctly via the lookup
  "americas",
  "na",
  "sa",
] as const
const HOMEPAGE_CONTINENT_ORDER_SET = new Set<string>(HOMEPAGE_CONTINENT_ORDER)

type StrapiMetadataAttribute = {
  columnName?: string
}

type StrapiMetadata = {
  attributes: Record<string, StrapiMetadataAttribute>
}

type HomepageSummaryParams = {
  locale?: string
  status: "draft" | "published"
}

const getOrderIndex = (continent: {
  code?: string | null
  name?: string | null
  slug?: string | null
}) => {
  const candidates = [continent.slug, continent.code, continent.name].filter(
    (value): value is string => typeof value === "string"
  )

  const match = candidates
    .map((value) => value.trim().toLowerCase())
    .find((value) => HOMEPAGE_CONTINENT_ORDER_SET.has(value))

  if (match == null) {
    return Number.MAX_SAFE_INTEGER
  }

  return HOMEPAGE_CONTINENT_ORDER.indexOf(
    match as (typeof HOMEPAGE_CONTINENT_ORDER)[number]
  )
}

export default factories.createCoreService(
  "api::continent.continent",
  ({ strapi }) => ({
    async getHomepageSummaries({ locale, status }: HomepageSummaryParams) {
      const continents = await strapi
        .documents("api::continent.continent")
        .findMany({
          fields: ["documentId", "name", "slug", "code"],
          locale,
          status,
        })

      if (!Array.isArray(continents) || continents.length === 0) {
        return []
      }

      const libraryMetadata = strapi.db.metadata.get(
        "api::library.library"
      ) as StrapiMetadata

      if (libraryMetadata.attributes.continent == null) {
        return continents.map((continent) => ({
          ...continent,
          libraryCount: 0,
        }))
      }

      const countsByDocumentId = new Map(
        await Promise.all(
          continents.map(async (continent) => {
            const documentId = continent.documentId

            if (typeof documentId !== "string" || documentId.length === 0) {
              return [documentId ?? "", 0] as const
            }

            const where: Record<string, unknown> = {
              continent: {
                documentId: {
                  $eq: documentId,
                },
              },
            }

            if (locale != null) {
              where.locale = locale
            }

            if (status === "published") {
              where.publishedAt = {
                $notNull: true,
              }
            }

            const libraryCount = await strapi.db
              .query("api::library.library")
              .count({ where })

            return [documentId, libraryCount] as const
          })
        )
      )

      return continents
        .map((continent) => ({
          ...continent,
          libraryCount: countsByDocumentId.get(continent.documentId) ?? 0,
        }))
        .sort((left, right) => {
          const leftOrder = getOrderIndex(left)
          const rightOrder = getOrderIndex(right)

          if (leftOrder !== rightOrder) {
            return leftOrder - rightOrder
          }

          return (left.name ?? "").localeCompare(right.name ?? "")
        })
    },
  })
)
