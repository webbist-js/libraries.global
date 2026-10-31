import { matchesBridgeSecret } from "@repo/shared-data/service-key"
import { NextResponse } from "next/server"
import { z } from "zod"

import { authDbPool } from "@/lib/auth"
import { readJsonCapped } from "@/lib/bridge-params"

const input = z
  .object({
    kind: z.enum(["users", "sessions"]),
    after: z.string().regex(/^\d*$/).max(20).default(""),
  })
  .strict()
const headers = { "Cache-Control": "private, no-store" }

/** Server-only, paged reconciliation feed. Never returns session tokens, IPs or email. */
export async function POST(req: Request) {
  if (!matchesBridgeSecret(req.headers.get("x-service-secret")))
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers }
    )
  const since = process.env.INTERNAL_NOTIFICATIONS_SINCE
  if (
    process.env.INTERNAL_NOTIFICATIONS_ENABLED !== "true" ||
    !since ||
    !Number.isFinite(Date.parse(since))
  )
    return NextResponse.json({ error: "Disabled" }, { status: 503, headers })
  const read = await readJsonCapped(req, 4096)
  const parsed = read.ok ? input.safeParse(read.body) : null
  if (!parsed?.success)
    return NextResponse.json(
      { error: "Invalid body" },
      { status: read.ok ? 400 : read.status, headers }
    )
  const { kind, after } = parsed.data
  // The originating DB transaction records the event, including sessions that
  // have already signed out. The FK removes these events on account erasure.
  const { rows } = await authDbPool.query(
    'SELECT e.id::text AS id, e.user_id AS "userId", e.created_at AS "createdAt", u."emailVerified" FROM internal_activity_events e JOIN "user" u ON u.id = e.user_id WHERE e.created_at >= $1 AND e.id > $2::bigint AND e.kind = $3 ORDER BY e.id LIMIT 101',
    [new Date(since), after || "0", kind]
  )

  return NextResponse.json(
    { data: rows.slice(0, 100), next: rows.length > 100 ? rows[99].id : "" },
    { headers }
  )
}
