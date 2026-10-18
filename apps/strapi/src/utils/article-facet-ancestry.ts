import type { ArticleBrowseItem, ArticleFacetValue } from "@repo/shared-data"

type Row = Record<string, any>
const ref = (row: Row | null | undefined): string | undefined =>
  typeof row?.documentId === "string" ? row.documentId : undefined
const groups = ["countries", "regions", "areas"] as const
const fields = {
  continents: "continentDocumentId",
  countries: "countryDocumentId",
  regions: "regionDocumentId",
} as const

/** Enrich old stamps with canonical parent IDs only when those parents are in the frozen context. */
export async function enrichArticleFacetAncestry(
  strapi: any,
  items: ArticleBrowseItem[]
): Promise<void> {
  for (const group of groups) {
    const ids = [
      ...new Set(
        items.flatMap((item) =>
          (item.facets[group] ?? [])
            .filter((facet) =>
              group === "countries"
                ? !facet.continentDocumentId
                : group === "regions"
                  ? !facet.countryDocumentId || !facet.continentDocumentId
                  : !facet.regionDocumentId ||
                    !facet.countryDocumentId ||
                    !facet.continentDocumentId
            )
            .map((facet) => facet.value)
        )
      ),
    ]
    const rows = new Map<string, Row>()
    for (let index = 0; index < ids.length; index += 500) {
      const batch = await strapi
        .documents(
          `api::${group === "countries" ? "country.country" : group === "regions" ? "region.region" : "area.area"}`
        )
        .findMany({
          status: "published",
          locale: "*",
          fields: ["name"],
          filters: { documentId: { $in: ids.slice(index, index + 500) } },
          limit: 500,
          populate: {
            ...(group !== "areas" ? { continent: { fields: ["name"] } } : {}),
            ...(group !== "countries"
              ? {
                  country: {
                    fields: ["name"],
                    populate: { continent: { fields: ["name"] } },
                  },
                }
              : {}),
            ...(group === "areas"
              ? {
                  region: {
                    fields: ["name"],
                    populate: {
                      country: {
                        fields: ["name"],
                        populate: { continent: { fields: ["name"] } },
                      },
                    },
                  },
                }
              : {}),
          },
        })
      for (const row of batch) if (ref(row)) rows.set(row.documentId, row)
    }
    for (const item of items)
      for (const facet of item.facets[group] ?? []) {
        const row = rows.get(facet.value)
        if (!row) continue
        const ancestors = {
          continents: ref(
            row.continent ??
              row.country?.continent ??
              row.region?.country?.continent
          ),
          countries: ref(row.country ?? row.region?.country),
          regions: ref(row.region),
        }
        for (const [parent, field] of Object.entries(fields) as [
          keyof typeof fields,
          keyof ArticleFacetValue,
        ][]) {
          const id = ancestors[parent]
          if (
            id &&
            (item.facets[parent] ?? []).some((value) => value.value === id) &&
            !(facet as any)[field]
          )
            (facet as any)[field] = id
        }
      }
  }
}
