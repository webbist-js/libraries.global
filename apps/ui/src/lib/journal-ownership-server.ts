import "server-only"
import { userHeaders } from "@/lib/bridge-user-headers"

export async function ownsJournalArticle(
  user: Parameters<typeof userHeaders>[0],
  slug: string
): Promise<boolean> {
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return false
  try {
    const response = await fetch(
      `${process.env.STRAPI_URL ?? "http://127.0.0.1:1337"}/api/content-moderation/articles/blog/${encodeURIComponent(slug)}/ownership`,
      { headers: userHeaders(user), cache: "no-store" }
    )
    if (!response.ok) return false
    const json = await response.json()

    return json.data?.isOwner === true
  } catch {
    return false
  }
}
