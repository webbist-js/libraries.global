import { NextResponse } from "next/server"

const MEILI_HOST =
  process.env.NEXT_PUBLIC_MEILISEARCH_HOST ?? "http://localhost:7700"
const MEILI_KEY = process.env.MEILISEARCH_SEARCH_API_KEY ?? ""

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q") ?? ""
  const country_slug = searchParams.get("country_slug") ?? ""

  const filter = country_slug ? `country_slug = "${country_slug}"` : undefined

  const body: Record<string, unknown> = { q, limit: 20 }
  if (filter) body.filter = filter

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
}
