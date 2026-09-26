import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { toSafeImageFile } from "@/lib/image-upload"
import { resolveUploadApiKey } from "@/lib/upload-token"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const file = formData.get("file") as File | null
  if (!file)
    return NextResponse.json({ error: "No file provided" }, { status: 400 })

  if (file.size > MAX_SIZE)
    return NextResponse.json(
      { error: "File too large (max 10 MB)" },
      { status: 400 }
    )

  const safeFile = await toSafeImageFile(file, [
    "image/jpeg",
    "image/png",
    "image/webp",
  ])
  if (!safeFile)
    return NextResponse.json(
      { error: "Invalid file type. Use JPEG, PNG, or WebP." },
      { status: 400 }
    )

  const apiToken = resolveUploadApiKey()
  if (!apiToken && process.env.NODE_ENV === "production")
    return NextResponse.json(
      { error: "Upload not configured" },
      { status: 500 }
    )

  const strapiForm = new FormData()
  strapiForm.append("files", safeFile, safeFile.name)

  const uploadRes = await fetch(`${STRAPI}/api/upload`, {
    method: "POST",
    headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {},
    body: strapiForm,
  })

  if (!uploadRes.ok) {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }

  const uploaded = (await uploadRes.json()) as { id: number; url: string }[]
  const first = uploaded[0]
  if (!first)
    return NextResponse.json(
      { error: "Upload returned no file" },
      { status: 500 }
    )

  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (secret) {
    try {
      const ownershipRes = await fetch(
        `${STRAPI}/api/content-moderation/uploads`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Service-Secret": secret,
            "X-Ba-User-Id": session.user.id,
            "X-Ba-User-Email": session.user.email,
          },
          body: JSON.stringify({ fileId: first.id }),
        }
      )
      if (!ownershipRes.ok)
        console.error(
          "Failed to record submission upload ownership",
          ownershipRes.status
        )
    } catch (err) {
      console.error("Failed to record submission upload ownership", err)
    }
  }

  return NextResponse.json({
    id: first.id,
    url: first.url.startsWith("http") ? first.url : `${STRAPI}${first.url}`,
  })
}
