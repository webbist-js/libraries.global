export type PlaygroundOperation = "search" | "list" | "read"
export type PlaygroundInput = {
  operation: PlaygroundOperation
  query: string
  entityRef: string
  limit: number
  locale: string
}
export const PLAYGROUND_MAX_RECORDS = 10

/** Build one of the three authenticated, metered API requests. */
export function playgroundRequest(input: PlaygroundInput) {
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
