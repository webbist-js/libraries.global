import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { getSessionSSR } from "@/lib/auth-server"

export default async function OwnProfilePage() {
  const session = await getSessionSSR(await headers())
  if (!session?.user) redirect("/auth/signin")

  // Fetch own profile to get username
  const strapiUrl = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  const apiToken = process.env.STRAPI_REST_READONLY_API_KEY
  try {
    const res = await fetch(
      `${strapiUrl}/api/user-profiles?filters[baUserId][$eq]=${encodeURIComponent(session.user.id)}`,
      {
        cache: "no-store",
        headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {},
      }
    )
    if (res.ok) {
      const json = (await res.json()) as { data?: { username?: string }[] }
      const username = json.data?.[0]?.username
      if (username) redirect(`/profile/${username}`)
    }
  } catch {
    // swallow — fallback redirect below
  }

  // Fallback: redirect to settings to complete profile
  redirect("/profile/settings")
}
