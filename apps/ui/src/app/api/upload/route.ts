import { headers } from "next/headers"

import { auth } from "@/lib/auth"

const STRAPI = process.env.NEXT_PUBLIC_STRAPI_URL ?? "http://127.0.0.1:1337"
const STRAPI_API_KEY = process.env.STRAPI_REST_READONLY_API_KEY ?? ""
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

  // Validate file type
  if (!file.type.startsWith("image/")) {
    return Response.json(
      { error: "Only image files are allowed" },
      { status: 400 }
    )
  }

  // Validate file size (5 MB max)
  if (file.size > 5 * 1024 * 1024) {
    return Response.json(
      { error: "File too large (max 5 MB)" },
      { status: 400 }
    )
  }

  const upload = new FormData()
  upload.append("files", file)

  const res = await fetch(`${STRAPI}/api/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${STRAPI_API_KEY}` },
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
