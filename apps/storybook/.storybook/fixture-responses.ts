export type FixtureResponse = {
  body?: unknown
  status?: number
  headers?: Record<string, string>
  delayMs?: number
}
export type FixtureResponses = Record<string, FixtureResponse>
export async function respondToFixture(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  responses: FixtureResponses
): Promise<Response | null> {
  const url = new URL(
    input instanceof Request ? input.url : String(input),
    window.location.href
  )
  const method = (
    init?.method ?? (input instanceof Request ? input.method : "GET")
  ).toUpperCase()
  const fixture =
    responses[`${method} ${url.href}`] ??
    responses[`${method} ${url.pathname}${url.search}`] ??
    responses[`${method} ${url.pathname}`]
  if (!fixture) return null
  if (fixture.delayMs)
    await new Promise((resolve) => setTimeout(resolve, fixture.delayMs))
  const status = fixture.status ?? 200

  return new Response(
    status === 204 ? null : JSON.stringify(fixture.body ?? null),
    {
      status,
      headers: { "Content-Type": "application/json", ...fixture.headers },
    }
  )
}
