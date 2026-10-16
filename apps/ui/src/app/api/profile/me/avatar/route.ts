import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { uploadOwnedImage } from "@/lib/owned-image-upload"
import { invalidateSessionProfile } from "@/lib/session-profile"
import { formatStrapiMediaUrlForClient } from "@/lib/strapi-helpers"

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const uploaded = await uploadOwnedImage(req, session.user, {
    field: "file",
    maxBytes: 5 * 1024 * 1024,
    purpose: "avatar",
    allowed: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  })
  if (!uploaded.ok) return uploaded.response
  try {
    const response = await fetch(
      `${process.env.STRAPI_URL ?? "http://127.0.0.1:1337"}/api/auth-bridge/upsert-profile`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Service-Secret": process.env.STRAPI_BRIDGE_SECRET!,
        },
        body: JSON.stringify({
          baUserId: session.user.id,
          avatarFileId: uploaded.file.id,
        }),
        signal: AbortSignal.timeout(5000),
      }
    )
    if (!response.ok)
      return NextResponse.json(
        { error: "Profile update failed" },
        { status: 502 }
      )
    invalidateSessionProfile(session.user.id)

    return NextResponse.json({
      url: formatStrapiMediaUrlForClient(uploaded.file.url),
    })
  } catch {
    return NextResponse.json(
      { error: "Profile update temporarily unavailable" },
      { status: 503 }
    )
  }
}
