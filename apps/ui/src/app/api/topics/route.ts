import { DEFAULT_LOCALE, isSupportedLocale } from "@repo/shared-data"
import { NextResponse } from "next/server"

import { cacheTagsFor } from "@/lib/strapi-api/cache-tags"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

export async function GET(req: Request) {
  const requestedLocale = new URL(req.url).searchParams.get("locale")
  const locale = isSupportedLocale(requestedLocale)
    ? requestedLocale
    : DEFAULT_LOCALE
  try {
    const res = await fetch(`${STRAPI}/api/topics/approved?locale=${locale}`, {
      next: { revalidate: 3600, tags: cacheTagsFor("/topics", {}) },
    })
    if (!res.ok) return NextResponse.json({ data: [] })
    const json = await res.json()

    return NextResponse.json(json)
  } catch {
    return NextResponse.json({ data: [] })
  }
}
