import { readFileSync } from "node:fs"
import path from "node:path"

import { CatalogueHttp } from "../src/http"

export function fixture(name: string): string {
  return readFileSync(path.join(__dirname, "fixtures", name), "utf8")
}

export interface Route {
  /** Substring or regex matched against the full request URL. */
  match: string | RegExp
  body?: string
  status?: number
  headers?: Record<string, string>
  method?: "GET" | "POST"
}

/**
 * A CatalogueHttp whose fetch serves canned responses. Unmatched requests
 * fail the test loudly so a connector can't silently hit the network.
 */
export function mockHttp(routes: Route[]): {
  http: CatalogueHttp
  requests: { url: string; method: string; body?: string }[]
} {
  const requests: { url: string; method: string; body?: string }[] = []
  const fetchImpl = (async (input: string, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? "GET"
    requests.push({ url, method, body: init?.body as string | undefined })
    const route = routes.find(
      (r) =>
        (!r.method || r.method === method) &&
        (typeof r.match === "string"
          ? url.includes(r.match)
          : r.match.test(url))
    )
    if (!route) throw new Error(`Unmocked request: ${method} ${url}`)

    return new Response(route.body ?? "", {
      status: route.status ?? 200,
      headers: route.headers,
    })
  }) as typeof fetch

  return {
    http: new CatalogueHttp({
      fetchImpl,
      hostGuard: async () => {},
      minIntervalMs: 0,
    }),
    requests,
  }
}
