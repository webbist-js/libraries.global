import { DEFAULT_LOCALE, isSupportedLocale } from "@repo/shared-data"

import { atlasCountries } from "@/lib/atlas-countries-server"

export const runtime = "nodejs"

/** GET /api/atlas/countries?locale=: the picker's countries and boundaries. */
export async function GET(req: Request) {
  const requested = new URL(req.url).searchParams.get("locale") ?? ""
  const locale = isSupportedLocale(requested) ? requested : DEFAULT_LOCALE
  try {
    return Response.json(await atlasCountries(locale, req.signal), {
      headers: { "cache-control": "public, max-age=300" },
    })
  } catch {
    return Response.json(
      { error: "Countries are temporarily unavailable" },
      { status: 503 }
    )
  }
}
