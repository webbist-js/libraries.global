import { matchesBridgeSecret } from "@repo/shared-data/service-key"
import { NextResponse } from "next/server"
import { z } from "zod"

import { authDbPool } from "@/lib/auth"
import { readJsonCapped } from "@/lib/bridge-params"

export async function POST(req: Request) {
  if (!matchesBridgeSecret(req.headers.get("x-service-secret")))
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
