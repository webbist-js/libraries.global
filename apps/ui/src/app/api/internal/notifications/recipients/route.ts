import { NextResponse } from "next/server"
import { z } from "zod"

import { authDbPool } from "@/lib/auth"
import { readJsonCapped } from "@/lib/bridge-params"
import { safeEqual } from "@/lib/safe-equal"

export async function POST(req: Request) {
  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret || !safeEqual(req.headers.get("x-service-secret") ?? "", secret))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const read = await readJsonCapped(req, 32 * 1024)
  const parsed = read.ok
    ? z
        .object({ ids: z.array(z.string().min(1).max(200)).min(1).max(100) })
        .strict()
        .safeParse(read.body)
    : null
  if (!parsed?.success)
    return NextResponse.json(
      { error: "Invalid body" },
      { status: read.ok ? 400 : read.status }
    )
  const { rows } = await authDbPool.query(
    'SELECT id, email FROM "user" WHERE id = ANY($1::text[]) AND "emailVerified" = true',
    [parsed.data.ids]
  )

  return NextResponse.json(
    { data: rows },
    { headers: { "Cache-Control": "private, no-store" } }
  )
}
