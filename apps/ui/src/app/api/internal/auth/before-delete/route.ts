import { matchesBridgeSecret } from "@repo/shared-data/service-key"
import { z } from "zod"

import { appDbPool } from "@/lib/app-db"
import { stopBillingBeforeDeletion } from "@/lib/billing/deletion"
import { readTypedJson } from "@/lib/typed-json"

/** Invoked by Strapi before every account erasure, including Better Auth's endpoint. */
export async function POST(request: Request) {
  if (!matchesBridgeSecret(request.headers.get("x-service-secret")))
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  const parsed = await readTypedJson(
    request,
    4096,
    z.object({ userId: z.string().regex(/^[1-9]\d{0,9}$/) }).strict()
  )
  if (!parsed.ok)
    return Response.json({ error: "Invalid body" }, { status: parsed.status })
  try {
    await stopBillingBeforeDeletion(appDbPool, parsed.body.userId)

    return Response.json({ ok: true })
  } catch {
    return Response.json(
      { error: "Account deletion unavailable" },
      { status: 503 }
    )
  }
}
