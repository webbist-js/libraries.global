import { PublicStrapiClient } from "@/lib/strapi-api"

export interface RegionOption {
  slug: string
  name: string
}

export async function fetchRegionsByCountry(
  countrySlug: string
): Promise<RegionOption[]> {
  try {
    const result = await PublicStrapiClient.fetchMany(
      "api::region.region",
      {
        filters: { country: { slug: { $eq: countrySlug } } },
        fields: ["name", "slug"],
        sort: { name: "asc" },
        pagination: { pageSize: 200 },
      } as never,
      { cache: "force-cache" },
      { useProxy: true }
    )

    return (result.data ?? [])
      .filter(
        (r): r is typeof r & { slug: string; name: string } =>
          typeof r.slug === "string" && typeof r.name === "string"
      )
      .map((r) => ({ slug: r.slug, name: r.name }))
  } catch {
    return []
  }
}
