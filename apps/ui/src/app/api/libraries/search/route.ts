import { NextResponse } from "next/server"

import { withSearchLocale } from "@/lib/meilisearch"

const MEILI_HOST =
  process.env.NEXT_PUBLIC_MEILISEARCH_HOST ?? "http://localhost:7700"

// Server-only key preferred; fall back to public key if only that is set
const MEILI_KEY =
  process.env.MEILISEARCH_SEARCH_API_KEY ??
  process.env.NEXT_PUBLIC_MEILISEARCH_SEARCH_KEY ??
  ""

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q") ?? ""
  const country_slug = searchParams.get("country_slug") ?? ""
  const continent_slug = searchParams.get("continent_slug") ?? ""

  // `locale` only selects among live locales; anything else is the default.
  const locale = searchParams.get("locale")

  const body: Record<string, unknown> = {
    q,
    limit: 20,
    filter: withSearchLocale(
      [
        continent_slug && `continent_slug = ${JSON.stringify(continent_slug)}`,
        country_slug && `country_slug = ${JSON.stringify(country_slug)}`,
      ],
      locale
    ),
  }

  try {
    const res = await fetch(`${MEILI_HOST}/indexes/library/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(MEILI_KEY ? { Authorization: `Bearer ${MEILI_KEY}` } : {}),
      },
      body: JSON.stringify(body),
      next: { revalidate: 0 },
    })

    if (!res.ok) return NextResponse.json({ hits: [] })
    const json = (await res.json()) as { hits: unknown[] }

    return NextResponse.json({ hits: json.hits })
  } catch {
    return NextResponse.json({ hits: [] })
  }
}
