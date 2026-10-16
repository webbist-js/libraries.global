import { headers } from "next/headers"

import { requireCapability } from "@/lib/access-server"
import { auth } from "@/lib/auth"
import { uploadOwnedImage } from "@/lib/owned-image-upload"
import { formatStrapiMediaUrlForClient } from "@/lib/strapi-helpers"

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  const denied = requireCapability(session?.user, "docs.directEdit")
  if (denied) return denied
  const uploaded = await uploadOwnedImage(req, session!.user, {
    field: "files",
    maxBytes: 5 * 1024 * 1024,
    purpose: "article",
    allowed: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  })
  if (!uploaded.ok) return uploaded.response

  return Response.json({
    id: uploaded.file.id,
    url: formatStrapiMediaUrlForClient(uploaded.file.url),
  })
}
