import { matchesBridgeSecret } from "@repo/shared-data/service-key"
import { revalidateTag } from "next/cache"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  if (!matchesBridgeSecret(req.headers.get("x-service-secret")))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  for (const tag of ["blog-article", "wiki-article", "user-profile"])
    revalidateTag(tag, { expire: 0 })

  return new Response(null, { status: 204 })
}
