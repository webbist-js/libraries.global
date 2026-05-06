// apps/ui/src/app/api/regions/route.ts
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const countrySlug = searchParams.get("countrySlug")
  if (!countrySlug) {
    return NextResponse.json({ data: [] })
  }

  const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  const API_TOKEN = process.env.STRAPI_REST_READONLY_API_KEY
  const headers: Record<string, string> = {}
  if (API_TOKEN) headers.Authorization = `Bearer ${API_TOKEN}`

  try {
    const res = await fetch(
      `${STRAPI}/api/regions?filters[country][slug][$eq]=${encodeURIComponent(countrySlug)}&fields[0]=name&fields[1]=slug&sort=name&pagination[pageSize]=200`,
      { headers, next: { revalidate: 3600 } }
    )
    if (!res.ok) return NextResponse.json({ data: [] })
    const json = await res.json()

    return NextResponse.json({ data: json.data ?? [] })
  } catch {
    return NextResponse.json({ data: [] })
  }
}
