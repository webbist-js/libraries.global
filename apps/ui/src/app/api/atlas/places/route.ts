import { DEFAULT_LOCALE, isSupportedLocale } from "@repo/shared-data"

import { PublicStrapiClient } from "@/lib/strapi-api"

export const runtime = "nodejs"

const SLUG = /^[a-z0-9][a-z0-9-]{0,99}$/

/**
 * GET /api/atlas/places?country=&region=&locale=: the Atlas place filters'
 * options: a country's regions with libraries and a region's areas.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams
  const country = params.get("country") ?? ""
  const region = params.get("region") ?? ""
  if (!SLUG.test(country) || (region && !SLUG.test(region)))
    return Response.json({ error: "Unknown place" }, { status: 400 })
  const requested = params.get("locale") ?? ""
  const locale = isSupportedLocale(requested) ? requested : DEFAULT_LOCALE
  try {
    const res = (await PublicStrapiClient.fetchAPI(
      `/countries/atlas/${encodeURIComponent(country)}/places`,
      { locale: locale as never, ...(region ? { region } : {}) } as never
    )) as { data?: unknown }
    if (!res.data)
      return Response.json({ error: "Unknown place" }, { status: 404 })

    return Response.json(
      { data: res.data },
      { headers: { "cache-control": "public, max-age=300" } }
    )
  } catch {
    return Response.json(
      { error: "Places are temporarily unavailable" },
      { status: 503 }
    )
  }
}
