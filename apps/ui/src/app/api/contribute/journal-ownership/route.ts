import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { userHeaders } from "@/lib/bridge-user-headers"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const PRIVATE = { "Cache-Control": "private, no-store" }

/** A bounded author capability hint; publication and edits still enforce ownership in the CMS. */
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: PRIVATE }
    )
  const slugs = [...new Set(new URL(req.url).searchParams.getAll("slug"))]
  if (
    !slugs.length ||
    slugs.length > 24 ||
    slugs.some((slug) => !/^[a-z0-9-]{1,120}$/.test(slug))
  )
    return NextResponse.json(
      { error: "Invalid story selection" },
      { status: 400, headers: PRIVATE }
    )
  if (!process.env.STRAPI_BRIDGE_SECRET)
    return NextResponse.json(
      { error: "Ownership unavailable" },
      { status: 503, headers: PRIVATE }
    )
  const eligibility: Record<string, boolean> = {}
  try {
    // Four at a time keeps authoring searches bounded on the host CMS.
    for (let offset = 0; offset < slugs.length; offset += 4)
      await Promise.all(
        slugs.slice(offset, offset + 4).map(async (slug) => {
          const response = await fetch(
            `${STRAPI}/api/content-moderation/articles/blog/${encodeURIComponent(slug)}/ownership`,
            {
              headers: userHeaders(session.user),
              cache: "no-store",
              signal: AbortSignal.any([req.signal, AbortSignal.timeout(10000)]),
            }
          )
          if (!response.ok) throw new Error("Ownership unavailable")
          const json = (await response.json()) as {
            data?: { isOwner?: unknown }
          }
          if (typeof json.data?.isOwner !== "boolean")
            throw new Error("Invalid ownership response")
          eligibility[slug] = json.data.isOwner
        })
      )

    return NextResponse.json({ data: { eligibility } }, { headers: PRIVATE })
  } catch {
    return NextResponse.json(
      { error: "Ownership unavailable" },
      { status: 503, headers: PRIVATE }
    )
  }
}
