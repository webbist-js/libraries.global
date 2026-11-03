export type PlaygroundOperation =
  | "search"
  | "list"
  | "read"
  | "places"
  | "placeLibraries"
export type PlaygroundInput = {
  operation: PlaygroundOperation
  query: string
  entityRef: string
  limit: number
  locale: string
  /** Place slugs for the /places operations, each under the one before. */
  country?: string
  region?: string
  area?: string
}

/** The /places path for the chosen country, region and area slugs. */
export function playgroundPlacePath(input: PlaygroundInput): string {
  const places = [input.country, input.region, input.area].map(
    (slug) => slug?.trim() ?? ""
  )
  const chain: string[] = []
  for (const slug of places) {
    if (!slug) break
    chain.push(encodeURIComponent(slug))
  }
  if (input.operation === "places") chain.splice(2)

  return [
    "/api/v1/places",
    ...chain,
    ...(input.operation === "placeLibraries" ? ["libraries"] : []),
  ].join("/")
}
export const PLAYGROUND_MAX_RECORDS = 10

/** Build one of the authenticated, metered API requests. */
export function playgroundRequest(input: PlaygroundInput) {
  if (input.operation === "places" || input.operation === "placeLibraries") {
    const query = new URLSearchParams({ locale: input.locale })
    if (input.operation === "placeLibraries")
      query.set("limit", String(input.limit))

    return {
      method: "GET",
      path: `${playgroundPlacePath(input)}?${query}`,
      body: undefined,
    }
  }
  if (input.operation === "search")
    return {
      method: "POST",
      path: "/api/v1/search/libraries",
      body: JSON.stringify({
        q: input.query,
        locale: input.locale,
        limit: input.limit,
      }),
    }
  const query = new URLSearchParams({ locale: input.locale })
  if (input.operation === "list") query.set("limit", String(input.limit))

  return {
    method: "GET",
    path: `/api/v1/libraries${input.operation === "read" ? `/${encodeURIComponent(input.entityRef.trim())}` : ""}?${query}`,
    body: undefined,
  }
}

export function playgroundRecords(
  body: unknown
): { name: string; entityRef: string }[] {
  if (
    !body ||
    typeof body !== "object" ||
    !("data" in body) ||
    !Array.isArray(body.data)
  )
    return []

  return body.data.flatMap((record: unknown) => {
    if (
      !record ||
      typeof record !== "object" ||
      !("name" in record) ||
      !("entityRef" in record) ||
      typeof record.name !== "string" ||
      typeof record.entityRef !== "string" ||
      !record.entityRef
    )
      return []

    return [{ name: record.name, entityRef: record.entityRef }]
  })
}

/** Places returned by GET /api/v1/places…, for browsing one level down. */
export function playgroundPlaces(
  body: unknown
): { name: string; slug: string; libraryCount: number }[] {
  if (
    !body ||
    typeof body !== "object" ||
    !("data" in body) ||
    !Array.isArray(body.data)
  )
    return []

  return body.data.flatMap((place: unknown) => {
    if (
      !place ||
      typeof place !== "object" ||
      !("slug" in place) ||
      !("name" in place) ||
      typeof place.slug !== "string" ||
      typeof place.name !== "string" ||
      "entityRef" in place
    )
      return []

    return [
      {
        name: place.name,
        slug: place.slug,
        libraryCount:
          "libraryCount" in place && typeof place.libraryCount === "number"
            ? place.libraryCount
            : 0,
      },
    ]
  })
}
