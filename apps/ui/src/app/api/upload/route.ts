import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import { toSafeImageFile } from "@/lib/image-upload"
import { resolveUploadApiKey } from "@/lib/upload-token"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const WIKI_EDITOR_ROLES = new Set(["wiki_editor", "editorial_board"])

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return Response.json({ error: "Unauthorized" }, { status: 401 })

  const role = (session.user as Record<string, unknown>).contributorRole as
    | string
    | undefined
  if (!role || !WIKI_EDITOR_ROLES.has(role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const formData = await req.formData()
  // Forward only the `files` field for security
  const file = formData.get("files")
  if (!file || !(file instanceof File)) {
    return Response.json({ error: "No file provided" }, { status: 400 })
  }

  // Validate file size (5 MB max) before reading it into memory
  if (file.size > 5 * 1024 * 1024) {
    return Response.json(
      { error: "File too large (max 5 MB)" },
      { status: 400 }
    )
  }

  // Validate by content, not the client-declared type. SVG is rejected: it is
  // served from the Strapi origin and can carry script.
  const safeFile = await toSafeImageFile(file, [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ])
  if (!safeFile) {
    return Response.json(
      { error: "Only JPEG, PNG, WebP or GIF images are allowed" },
      { status: 400 }
    )
  }

  const apiKey = resolveUploadApiKey()
  if (!apiKey) {
    const status = process.env.NODE_ENV === "production" ? 500 : 503

    return Response.json({ error: "Upload not configured" }, { status })
  }

  const upload = new FormData()
  upload.append("files", safeFile, safeFile.name)

  const res = await fetch(`${STRAPI}/api/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: upload,
  })

  if (!res.ok) {
    return Response.json({ error: "Upload failed" }, { status: 502 })
  }

  const data = await res.json()
  // data is an array of uploaded files
  const uploaded = Array.isArray(data) ? data[0] : data

  return Response.json({ id: uploaded.id, url: uploaded.url })
}
