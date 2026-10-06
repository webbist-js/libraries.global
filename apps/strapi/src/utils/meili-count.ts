/**
 * Exact counts over the `library` Meilisearch index for the drive lifecycle
 * (`runLifecycle` in `api::drive.drive`'s service) and nothing else: a raw
 * `fetch` against the admin key, never the public search key, and never
 * `totalHits` — which stops at the index's `maxTotalHits` of 1,000 (ADR-0004)
 * — but the summed `locale` facet, which doesn't.
 */

type FacetDistribution = Record<string, Record<string, number>>

/**
 * The number of libraries matching `filter`, summed across the `locale`
 * facet so the count is exact past 1,000 hits. Throws on a non-2xx
 * response.
 */
export async function countLibraries(filter: string): Promise<number> {
  const host = process.env.MEILISEARCH_HOST ?? "http://localhost:7700"
  const apiKey = process.env.MEILISEARCH_ADMIN_API_KEY ?? ""

  const res = await fetch(`${host}/indexes/library/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ q: "", filter, limit: 0, facets: ["locale"] }),
  })

  if (!res.ok) {
    throw new Error(
      `Meilisearch library count failed: ${res.status} ${res.statusText}`
    )
  }

  const json = (await res.json()) as {
    facetDistribution?: FacetDistribution
  }
  const locales = json.facetDistribution?.locale ?? {}

  return Object.values(locales).reduce((sum, n) => sum + n, 0)
}
