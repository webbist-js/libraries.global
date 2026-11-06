export type PlaygroundOperation =
  | "search"
  | "list"
  | "read"
  | "places"
  | "placeLibraries"
  | "services"
  | "service"
  | "serviceLibraries"
  | "summary"
  | "reach"
  | "job"
  | "jobResult"
  | "proposal"
/** Operations for the service, analysis and submission resources. */
export const PLAYGROUND_RESOURCE_OPERATIONS: readonly PlaygroundOperation[] = [
  "services",
  "service",
  "serviceLibraries",
  "summary",
  "reach",
  "job",
  "jobResult",
  "proposal",
]
export type PlaygroundSummaryOperation =
  | "service.profile"
  | "service.coverage"
  | "place.profile"
  | "place.coverage"
export type PlaygroundReachMode = "library" | "service" | "network"
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
  /** A service's stable ref (its CMS document id). */
  serviceRef?: string
  summaryOperation?: PlaygroundSummaryOperation
  reachMode?: PlaygroundReachMode
  travelMode?: "walking" | "cycling"
  minutes?: number
  areaCode?: string
  jobId?: string
  proposalId?: string
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

const segment = (value: string | undefined) =>
  encodeURIComponent((value ?? "").trim())

/** Requests for the service, analysis and submission resources. */
function resourceRequest(input: PlaygroundInput) {
  const query = new URLSearchParams({ locale: input.locale })
  switch (input.operation) {
    case "services":
      query.set("limit", String(input.limit))

      return {
        method: "GET",
        path: `/api/v1/services?${query}`,
        body: undefined,
      }
    case "service":
      return {
        method: "GET",
        path: `/api/v1/services/${segment(input.serviceRef)}?${query}`,
        body: undefined,
      }
    case "serviceLibraries":
      query.set("limit", String(input.limit))

      return {
        method: "GET",
        path: `/api/v1/services/${segment(input.serviceRef)}/libraries?${query}`,
        body: undefined,
      }
    case "summary": {
      const operation = input.summaryOperation ?? "service.profile"
      const place = Object.fromEntries(
        (["country", "region", "area"] as const).flatMap((key) =>
          input[key]?.trim() ? [[key, input[key]!.trim()]] : []
        )
      )

      return {
        method: "POST",
        path: "/api/v1/analysis/summary",
        body: JSON.stringify({
          operation,
          ...(operation.startsWith("service.")
            ? { ref: (input.serviceRef ?? "").trim() }
            : { place }),
          locale: input.locale,
        }),
      }
    }
    case "reach": {
      const mode = input.reachMode ?? "library"

      return {
        method: "POST",
        path: "/api/v1/analysis/reach",
        body: JSON.stringify({
          mode,
          ref: (mode === "library"
            ? input.entityRef
            : (input.serviceRef ?? "")
          ).trim(),
          travelMode: input.travelMode ?? "walking",
          ...(input.minutes ? { minutes: input.minutes } : {}),
          ...(mode === "service"
            ? { areaCode: (input.areaCode ?? "").trim() }
            : {}),
        }),
      }
    }
    case "job":
    case "jobResult":
      return {
        method: "GET",
        path: `/api/v1/analysis/jobs/${segment(input.jobId)}${input.operation === "jobResult" ? "/result" : ""}`,
        body: undefined,
      }

    default:
      return {
        method: "GET",
        path: `/api/v1/submissions/${segment(input.proposalId)}`,
        body: undefined,
      }
  }
}

/** The key scope an operation needs, for the key field's hint. */
export function playgroundScope(operation: PlaygroundOperation) {
  if (operation === "search") return "search:read"
  if (["services", "service", "serviceLibraries"].includes(operation))
    return "services:read"
  if (["summary", "reach", "job", "jobResult"].includes(operation))
    return "analysis:run"
  if (operation === "proposal") return "submissions:write"

  return "libraries:read"
}

/** The job id and state from a summary, Reach or job-status response. */
export function playgroundJob(
  body: unknown
): { id: string; state: string; retryAfter: number } | null {
  const job =
    body && typeof body === "object" && "job" in body
      ? (body as { job?: unknown }).job
      : null
  if (
    !job ||
    typeof job !== "object" ||
    typeof (job as { id?: unknown }).id !== "string" ||
    typeof (job as { state?: unknown }).state !== "string"
  )
    return null
  const retry = (job as { retryAfter?: unknown }).retryAfter

  return {
    id: (job as { id: string }).id,
    state: (job as { state: string }).state,
    retryAfter:
      typeof retry === "number" && retry >= 3 && retry <= 60 ? retry : 3,
  }
}

/** Services returned by GET /api/v1/services, for choosing one. */
export function playgroundServices(
  body: unknown
): { name: string; ref: string; serviceType: string }[] {
  if (!body || typeof body !== "object" || !("data" in body)) return []
  const data = (body as { data?: unknown }).data
  if (!Array.isArray(data)) return []

  return data.flatMap((row: unknown) => {
    const r = row as Record<string, unknown> | null

    return r &&
      typeof r.ref === "string" &&
      typeof r.name === "string" &&
      typeof r.serviceType === "string"
      ? [{ name: r.name, ref: r.ref, serviceType: r.serviceType }]
      : []
  })
}

/** Build one of the authenticated, metered API requests. */
export function playgroundRequest(input: PlaygroundInput) {
  if (PLAYGROUND_RESOURCE_OPERATIONS.includes(input.operation))
    return resourceRequest(input)
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
