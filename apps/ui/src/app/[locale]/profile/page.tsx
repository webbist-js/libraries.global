import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { getSessionSSR } from "@/lib/auth-server"

export default async function OwnProfilePage() {
  const session = await getSessionSSR(await headers())
  if (!session?.user) redirect("/auth/signin")

  // Fetch own profile to get username
  const strapiUrl = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  try {
    const res = await fetch(
      `${strapiUrl}/api/user-profiles?filters[baUserId][$eq]=${encodeURIComponent(session.user.id)}`,
      { cache: "no-store" }
    )
    if (res.ok) {
      const json = (await res.json()) as { data?: Array<{ attributes?: { username?: string } }> }
      const username = json.data?.[0]?.attributes?.username
      if (username) redirect(`/profile/${username}`)
    }
  } catch {}

  // Fallback: redirect to settings to complete profile
  redirect("/settings")
}
