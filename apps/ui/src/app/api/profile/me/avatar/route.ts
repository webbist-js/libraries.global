import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"

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

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file)
    return NextResponse.json({ error: "No file provided" }, { status: 400 })

  if (file.size > 5 * 1024 * 1024)
    return NextResponse.json(
      { error: "File too large (max 5 MB)" },
      { status: 400 }
    )

  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"]
  if (!allowed.includes(file.type))
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 })

  // Forward to Strapi upload
  const strapiForm = new FormData()
  strapiForm.append("files", file, file.name)

  const uploadRes = await fetch(`${STRAPI}/api/upload`, {
    method: "POST",
    body: strapiForm,
  })
  if (!uploadRes.ok)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })

  const uploaded = (await uploadRes.json()) as {
    id: number
    url: string
  }[]
  const first = uploaded[0]
  if (!first)
    return NextResponse.json(
      { error: "Upload returned no file" },
      { status: 500 }
    )
  const { id, url } = first

  // Update profile with new avatar
  const profileRes = await fetch(`${STRAPI}/api/auth-bridge/upsert-profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Service-Secret": SECRET },
    body: JSON.stringify({
      baUserId: session.user.id,
      avatarUrl: url.startsWith("http") ? url : `${STRAPI}${url}`,
      avatarStrapiId: String(id),
    }),
  })
  if (!profileRes.ok)
    return NextResponse.json(
      { error: "Profile update failed" },
      { status: 500 }
    )

  return NextResponse.json({
    url: url.startsWith("http") ? url : `${STRAPI}${url}`,
  })
}
