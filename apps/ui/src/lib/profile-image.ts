import "server-only"

import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { uploadOwnedImage } from "@/lib/owned-image-upload"
import { isSameOrigin, sameOriginResponse } from "@/lib/same-origin"
import { invalidateSessionProfile } from "@/lib/session-profile"
import { formatStrapiMediaUrlForClient } from "@/lib/strapi-helpers"

type ProfileImage = "avatar" | "cover"
const field = (kind: ProfileImage) =>
  kind === "avatar" ? "avatarFileId" : "coverImageFileId"

async function attach(
  userId: string,
  kind: ProfileImage,
  fileId: number | null
) {
  return fetch(
    `${process.env.STRAPI_URL ?? "http://127.0.0.1:1337"}/api/auth-bridge/upsert-profile`,
    {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Secret": process.env.STRAPI_BRIDGE_SECRET!,
      },
      body: JSON.stringify({ baUserId: userId, [field(kind)]: fileId }),
      signal: AbortSignal.timeout(5000),
    }
  )
}

/** Both public profile image adapters share ownership, storage limits and attachment. */
export async function uploadProfileImage(req: Request, kind: ProfileImage) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const uploaded = await uploadOwnedImage(req, session.user, {
    field: "file",
    maxBytes: 5 * 1024 * 1024,
    purpose: kind,
    allowed:
      kind === "avatar"
        ? ["image/jpeg", "image/png", "image/webp", "image/gif"]
        : ["image/jpeg", "image/png", "image/webp"],
  })
  if (!uploaded.ok) return uploaded.response
  try {
    const response = await attach(session.user.id, kind, uploaded.file.id)
    if (!response.ok)
      return NextResponse.json(
        { error: "Profile update failed" },
        { status: 502 }
      )
    invalidateSessionProfile(session.user.id)

    return NextResponse.json(
      { url: formatStrapiMediaUrlForClient(uploaded.file.url) },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch {
    return NextResponse.json(
      { error: "Profile update temporarily unavailable" },
      { status: 503 }
    )
  }
}

/** Clearing a cover is reversible by reattaching an owned upload; it never deletes media. */
export async function clearProfileCover(req: Request) {
  if (
    !isSameOrigin(
      req,
      process.env.APP_PUBLIC_URL ?? process.env.NEXT_PUBLIC_APP_URL
    )
  )
    return sameOriginResponse()
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!process.env.STRAPI_BRIDGE_SECRET)
    return NextResponse.json(
      { error: "Bridge not configured" },
      { status: 503 }
    )
  try {
    const response = await attach(session.user.id, "cover", null)
    if (!response.ok)
      return NextResponse.json(
        { error: "Profile update failed" },
        { status: 502 }
      )
    invalidateSessionProfile(session.user.id)

    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch {
    return NextResponse.json(
      { error: "Profile update temporarily unavailable" },
      { status: 503 }
    )
  }
}
