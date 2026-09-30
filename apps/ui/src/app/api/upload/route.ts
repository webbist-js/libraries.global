import { headers } from "next/headers"

import { requireCapability } from "@/lib/access-server"
import { auth } from "@/lib/auth"
import { toSafeImageFile } from "@/lib/image-upload"
import { formatStrapiMediaUrlForClient } from "@/lib/strapi-helpers"
import {
  enforceUploadQuota,
  recordUpload,
  rejectOversizedRequest,
} from "@/lib/upload-quota"
import { resolveUploadApiKey } from "@/lib/upload-token"

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  const denied = requireCapability(session?.user, "docs.directEdit")
  if (denied) return denied

  // Refuse from the declared size before the body is read at all.
  const oversized = rejectOversizedRequest(req, MAX_SIZE)
  if (oversized) return oversized

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 })
  }
  // Forward only the `files` field for security
  const file = formData.get("files")
  if (!file || !(file instanceof File)) {
    return Response.json({ error: "No file provided" }, { status: 400 })
  }

  // Validate file size (5 MB max) before reading it into memory
  if (file.size > MAX_SIZE) {
    return Response.json(
      { error: "File too large (max 5 MB)" },
      { status: 413 }
    )
  }

  const overQuota = await enforceUploadQuota(session!.user.id, file.size)
  if (overQuota) return overQuota

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

  const strapiUrl = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  const upload = new FormData()
  upload.append("files", safeFile, safeFile.name)

  const res = await fetch(`${strapiUrl}/api/upload`, {
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
  recordUpload(session!.user.id, safeFile.size)

  return Response.json({
    id: uploaded.id,
    url: formatStrapiMediaUrlForClient(uploaded.url),
  })
}
