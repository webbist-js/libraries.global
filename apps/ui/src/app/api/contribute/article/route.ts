import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SLUG = /^[a-z0-9-]{1,120}$/
const LOCALE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/

const DETAIL: Record<string, string> = {
  knowledge: "wiki-articles",
  journal: "blog-articles",
}

/**
 * GET /api/contribute/article?kind=&slug=&locale= — a published article in
 * one language, for the editor to load an existing translation. Null data
 * when that language hasn't been written yet.
 */
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const kind = searchParams.get("kind") ?? ""
  const slug = searchParams.get("slug") ?? ""
  const locale = searchParams.get("locale") ?? ""
  const plural = DETAIL[kind]
  if (!plural || !SLUG.test(slug) || !LOCALE.test(locale))
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })

  const apiToken = process.env.STRAPI_REST_READONLY_API_KEY
  const res = await fetch(
    `${STRAPI}/api/${plural}/detail/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}`,
    {
      cache: "no-store",
      headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {},
    }
  )
  if (!res.ok) return NextResponse.json({ data: null })
  const json = (await res.json()) as {
    data?: { title?: string; summary?: string | null; body?: unknown } | null
  }
  if (!json.data) return NextResponse.json({ data: null })

  return NextResponse.json({
    data: {
      title: json.data.title ?? "",
      summary: json.data.summary ?? "",
      body: json.data.body ?? [],
    },
  })
}
