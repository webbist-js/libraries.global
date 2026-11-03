import { DEFAULT_LOCALE, isSupportedLocale } from "@repo/shared-data"

import { atlasCountryDetail } from "@/lib/atlas-countries-server"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ slug: string }> }

/** GET /api/atlas/countries/[slug]?locale=: one country for the drawer. */
export async function GET(req: Request, { params }: Ctx) {
  const { slug } = await params
  if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(slug))
    return Response.json({ error: "Unknown country" }, { status: 404 })
  const requested = new URL(req.url).searchParams.get("locale") ?? ""
  const locale = isSupportedLocale(requested) ? requested : DEFAULT_LOCALE
  try {
    const country = await atlasCountryDetail(slug, locale)
    if (!country)
      return Response.json({ error: "Unknown country" }, { status: 404 })

    return Response.json(
      { data: country },
      { headers: { "cache-control": "public, max-age=300" } }
    )
  } catch {
    return Response.json(
      { error: "This country is temporarily unavailable" },
      { status: 503 }
    )
  }
}
