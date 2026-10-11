import { type NextRequest, NextResponse } from "next/server"

import { findPlaceCatalogue } from "@/lib/find-place-catalogue-server"
import type { FindPlaceLevel } from "@/lib/find-places"

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const level = params.get("level")
  const slug = params.get("slug")
  if (
    !level ||
    !["continent", "country", "region", "area"].includes(level) ||
    !slug ||
    !/^[\p{L}\p{N}_-]{1,200}$/u.test(slug)
  )
    return NextResponse.json({ error: "Invalid place" }, { status: 400 })
  const data = await findPlaceCatalogue(
    { level: level as FindPlaceLevel, slug },
    params.get("locale") ?? undefined
  )

  return NextResponse.json({ data: data ?? null }, { status: data ? 200 : 503 })
}
