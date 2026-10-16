import { revalidateTag } from "next/cache"
import { NextResponse } from "next/server"

import { readJsonCapped } from "@/lib/bridge-params"
import { safeEqual } from "@/lib/safe-equal"
import { entryKey, isCacheModel } from "@/lib/strapi-api/cache-tags"

/**
 * POST /api/revalidate — purge the fetch cache for a changed Strapi entry.
 *
 * Configure a Strapi webhook (Settings → Webhooks) for entry publish,
 * unpublish, update and delete, with the URL `<APP_PUBLIC_URL>/api/revalidate`
 * and the header `X-Revalidate-Secret: <REVALIDATE_SECRET>`. Strapi's body
 * carries `model` (e.g. "library") and `entry` (with its `slug`); the tags
 * `<model>` and `<model>:<slug>` are those `lib/strapi-api/base.ts` sets.
 */
export async function POST(req: Request) {
  const secret = process.env.REVALIDATE_SECRET
  if (!secret)
    return NextResponse.json(
      { error: "Revalidation is not configured" },
      { status: 503 }
    )
  const given = req.headers.get("x-revalidate-secret") ?? ""
  if (!safeEqual(given, secret))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = await readJsonCapped(req, 256 * 1024)
  if (!parsed.ok)
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: parsed.status }
    )
  const body = (parsed.body ?? {}) as {
    model?: unknown
    entry?: { slug?: unknown; documentId?: unknown } | null
  }

  const model = typeof body.model === "string" ? body.model : ""
  if (!isCacheModel(model) && model !== "user-profile")
    return NextResponse.json({ error: "Unknown model" }, { status: 400 })

  const tags = [model]
  if (
    [
      "user-profile",
      "topic",
      "country",
      "continent",
      "region",
      "area",
      "library",
      "blog-section",
      "wiki-section",
    ].includes(model)
  )
    tags.push("blog-article", "wiki-article")
  const entry = entryKey(body.entry?.slug) ?? entryKey(body.entry?.documentId)
  if (entry) tags.push(`${model}:${entry}`)

  for (const tag of tags)
    revalidateTag(tag, model === "user-profile" ? { expire: 0 } : "max")

  return NextResponse.json({ revalidated: tags })
}
