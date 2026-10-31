import { libraryTypeName } from "@repo/shared-data"
import { NextResponse } from "next/server"

import { allowLibraryLookup } from "@/lib/library-query-rate"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q") ?? ""
  if (!q || q.length < 2) return NextResponse.json({ data: [] })
  if (q.length > 200)
    return NextResponse.json({ error: "Invalid search" }, { status: 400 })
  try {
    if (!(await allowLibraryLookup(req)))
      return NextResponse.json({ error: "Too many searches" }, { status: 429 })
    const host = process.env.MEILISEARCH_HOST
    const key = process.env.MEILISEARCH_SEARCH_API_KEY
    if (!host || !key)
      return NextResponse.json({ error: "Search unavailable" }, { status: 503 })
    const search = await fetch(
      `${host.replace(/\/$/, "")}/indexes/library/search`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q,
          limit: 10,
          filter: 'locale = "en"',
          attributesToRetrieve: ["documentId"],
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      }
    )
    if (!search.ok)
      return NextResponse.json({ error: "Search unavailable" }, { status: 503 })
    const result = (await search.json()) as {
      hits?: { documentId?: unknown }[]
    }
    const ids = (result.hits ?? [])
      .slice(0, 10)
      .map((hit) => hit.documentId)
      .filter(
        (id): id is string =>
          typeof id === "string" && /^[a-z0-9]{20,32}$/.test(id)
      )
    if (!ids.length) return NextResponse.json({ data: [] })
    const params = new URLSearchParams({
      status: "published",
      "pagination[limit]": "10",
    })
    ids.forEach((id, index) =>
      params.set(`filters[documentId][$in][${index}]`, id)
    )
    const res = await fetch(`${STRAPI}/api/libraries?${params}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return NextResponse.json({ data: [] })
    const json = await res.json()

    return NextResponse.json({
      data: (json.data ?? []).map((library: Record<string, unknown>) => ({
        ...library,
        libraryType: libraryTypeName(library.libraryType),
      })),
    })
  } catch {
    return NextResponse.json({ data: [] })
  }
}
