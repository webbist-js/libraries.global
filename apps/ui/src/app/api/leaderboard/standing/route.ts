import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { getSessionSSR } from "@/lib/auth-server"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET

export async function GET(): Promise<Response> {
  const session = await getSessionSSR(await headers())
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!SECRET) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 })
  }

  try {
    const res = await fetch(`${STRAPI}/api/rewards/my-standing`, {
      cache: "no-store",
      headers: {
        "X-Service-Secret": SECRET,
        "X-Ba-User-Id": session.user.id,
      },
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: "Upstream error" },
        { status: res.status }
      )
    }

    const json = await res.json()

    return NextResponse.json(json)
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
