import { type NextRequest, NextResponse } from "next/server"
import type { Locale } from "next-intl"

import { fetchAboutGlobeRecord } from "@/lib/about-server"
import { routing } from "@/lib/navigation"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const locale =
    request.nextUrl.searchParams.get("locale") ?? routing.defaultLocale
  if (
    !routing.locales.includes(locale as Locale) ||
    !/^[a-z0-9-]{1,100}$/.test(slug)
  )
    return NextResponse.json(
      { error: "Invalid country request" },
      { status: 400 }
    )
  try {
    const record = await fetchAboutGlobeRecord(slug, locale as Locale)

    return record
      ? NextResponse.json({ data: record })
      : NextResponse.json({ error: "Country unavailable" }, { status: 404 })
  } catch {
    return NextResponse.json(
      { error: "Country details are temporarily unavailable" },
      { status: 503 }
    )
  }
}
