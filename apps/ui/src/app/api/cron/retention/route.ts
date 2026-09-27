import { NextResponse } from "next/server"

import { authDbPool } from "@/lib/auth"
import { isCronRequest, purgeExpiredAuthRecords } from "@/lib/auth-retention"

export const dynamic = "force-dynamic"

/**
 * GET /api/cron/retention — daily clean-up of expired sign-in records, run by
 * Vercel Cron (see vercel.json). Requires CRON_SECRET.
 */
export async function GET(req: Request) {
  if (!isCronRequest(req.headers.get("authorization"), process.env.CRON_SECRET))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const deleted = await purgeExpiredAuthRecords(authDbPool)

  return NextResponse.json({ ok: true, deleted })
}
