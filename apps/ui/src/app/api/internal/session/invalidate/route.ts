import { matchesBridgeSecret } from "@repo/shared-data/service-key"
import { NextResponse } from "next/server"
import { z } from "zod"

import { readJsonCapped } from "@/lib/bridge-params"
import { invalidateSessionProfile } from "@/lib/session-profile"

const Body = z.object({ baUserId: z.string().min(1).max(200) })

/**
 * POST /api/internal/session/invalidate — drop one user's cached session
 * profile so a role grant change shows at their next session read.
 *
 * Strapi's `role-grant` lifecycle calls this with `X-Service-Secret:
 * <STRAPI_BRIDGE_SECRET>` and `{ baUserId }`. Best effort and per instance:
 * the 60-second profile TTL remains the guarantee.
 */
export async function POST(req: Request) {
  const given = req.headers.get("x-service-secret") ?? ""
  if (!matchesBridgeSecret(given))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const read = await readJsonCapped(req, 4 * 1024)
  const parsed = read.ok ? Body.safeParse(read.body) : null
  if (!parsed?.success)
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: read.ok ? 400 : read.status }
    )

  invalidateSessionProfile(parsed.data.baUserId)

  return new Response(null, { status: 204 })
}
