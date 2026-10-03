/** Crawlers and CDNs may keep a sitemap for an hour, and serve it stale for a day. */
const CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400"

export function xmlResponse(body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": CACHE_CONTROL,
    },
  })
}

export function notFound(): Response {
  return new Response("Not found", { status: 404 })
}

/** Strapi was unreachable: ask the crawler to come back rather than serve a partial file. */
export function unavailable(): Response {
  return new Response("Sitemap temporarily unavailable", {
    status: 503,
    headers: { "Retry-After": "3600" },
  })
}
