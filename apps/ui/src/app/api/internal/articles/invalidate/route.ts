import { revalidateTag } from "next/cache"
import { NextResponse } from "next/server"

import { safeEqual } from "@/lib/safe-equal"

export async function POST(req: Request) {
  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret || !safeEqual(req.headers.get("x-service-secret") ?? "", secret))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  for (const tag of ["blog-article", "wiki-article", "user-profile"])
    revalidateTag(tag, { expire: 0 })

  return new Response(null, { status: 204 })
}
