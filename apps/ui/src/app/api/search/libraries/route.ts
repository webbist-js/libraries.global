import { libraryTypeName } from "@repo/shared-data"
import { NextResponse } from "next/server"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q") ?? ""
  if (!q || q.length < 2) return NextResponse.json({ data: [] })
  try {
    const res = await fetch(
      `${STRAPI}/api/libraries?filters[name][$containsi]=${encodeURIComponent(q)}&fields[0]=name&fields[1]=slug&fields[2]=city&fields[3]=entityRef&populate[libraryType][fields][0]=name&fields[5]=streetAddress&fields[6]=postalCode&fields[7]=location&populate[continent][fields][0]=documentId&populate[country][fields][0]=documentId&populate[country][fields][1]=name&populate[region][fields][0]=documentId&populate[area][fields][0]=documentId&pagination[limit]=10`,
      { cache: "no-store" }
    )
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
