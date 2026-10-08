export type SupportersQuery = {
  q?: string
  country?: string
  region?: string
  sort?: string
  page?: string
}

export function supportersParams(query: SupportersQuery): URLSearchParams {
  const params = new URLSearchParams()
  for (const key of ["q", "country", "region", "sort", "page"] as const)
    if (query[key]) params.set(key, query[key].slice(0, 100))

  return params
}

export function supportersHref(query: SupportersQuery, page = 1): string {
  const params = supportersParams({ ...query, page: String(page) })

  return `/community/supporters?${params}#our-supporters`
}
