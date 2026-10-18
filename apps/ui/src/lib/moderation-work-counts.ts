import "server-only"

import { bridgeUserHeaders } from "@/lib/bridge-user-headers"

/** Count-only projection; discussion text is never passed to the workspace. */
export async function fetchDiscussionReviewCount(user: {
  id: string
  email: string
  name?: string | null
}): Promise<number | null> {
  if (!process.env.STRAPI_BRIDGE_SECRET) return null
  try {
    const counts = await Promise.all(
      ["revisions", "reports"].map(async (kind) => {
        const response = await fetch(
          new URL(
            `/api/discussions/moderation/${kind}?limit=1${kind === "revisions" ? "&reviewableOnly=true" : ""}`,
            process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
          ),
          {
            headers: bridgeUserHeaders(user),
            cache: "no-store",
            signal: AbortSignal.timeout(15000),
          }
        )
        if (!response.ok) throw new Error("Count unavailable")
        const body = (await response.json()) as { total?: number }
        if (!Number.isSafeInteger(body.total) || body.total! < 0)
          throw new Error("Count unavailable")

        return body.total!
      })
    )

    return counts.reduce((total, count) => total + count, 0)
  } catch {
    return null
  }
}
