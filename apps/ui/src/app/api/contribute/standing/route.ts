import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { getSessionSSR } from "@/lib/auth-server"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET ?? ""

export async function GET() {
  const session = await getSessionSSR(await headers())
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const baUserId = session.user.id
  try {
    const res = await fetch(`${STRAPI}/api/rewards/my-standing`, {
      cache: "no-store",
      headers: {
        "X-Ba-User-Id": baUserId,
        "X-Service-Secret": SECRET,
      },
    })
    if (!res.ok)
      return NextResponse.json({ error: "Upstream error" }, { status: 502 })
    const json = await res.json()

    return NextResponse.json(json)
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
