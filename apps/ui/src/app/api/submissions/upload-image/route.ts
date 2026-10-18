import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { uploadOwnedImage } from "@/lib/owned-image-upload"
import { formatStrapiMediaUrlForClient } from "@/lib/strapi-helpers"

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const uploaded = await uploadOwnedImage(req, session.user, {
    field: "file",
    maxBytes: 10 * 1024 * 1024,
    purpose: "submission",
    allowed: ["image/jpeg", "image/png", "image/webp"],
  })
  if (!uploaded.ok) return uploaded.response

  return NextResponse.json({
    id: uploaded.file.id,
    url: formatStrapiMediaUrlForClient(uploaded.file.url),
  })
}
