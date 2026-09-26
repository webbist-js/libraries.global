import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { toSafeImageFile } from "@/lib/image-upload"
import { resolveUploadApiKey } from "@/lib/upload-token"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!SECRET)
    return NextResponse.json(
      { error: "Bridge not configured" },
      { status: 500 }
    )

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  const file = formData.get("file") as File | null
  if (!file)
    return NextResponse.json({ error: "No file provided" }, { status: 400 })

  if (file.size > 5 * 1024 * 1024)
    return NextResponse.json(
      { error: "File too large (max 5 MB)" },
      { status: 400 }
    )

  const safeFile = await toSafeImageFile(file, [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ])
  if (!safeFile)
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 })

  // Upload file to Strapi media library
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
  if (!uploadRes.ok)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })

  const uploaded = (await uploadRes.json()) as { id: number; url: string }[]
  const first = uploaded[0]
  if (!first)
    return NextResponse.json(
      { error: "Upload returned no file" },
      { status: 500 }
    )

  const { id, url } = first
  const absoluteUrl = url.startsWith("http") ? url : `${STRAPI}${url}`

  // Connect the uploaded file to the user's profile avatar media field
  const profileRes = await fetch(`${STRAPI}/api/auth-bridge/upsert-profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Service-Secret": SECRET },
    body: JSON.stringify({
      baUserId: session.user.id,
      avatarFileId: id,
    }),
  })
  if (!profileRes.ok)
    return NextResponse.json(
      { error: "Profile update failed" },
      { status: 500 }
    )

  return NextResponse.json({ url: absoluteUrl })
}
