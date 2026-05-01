import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { getSessionSSR } from "@/lib/auth-server"
import type { UserProfile } from "@/lib/types/profile"

export default async function OnboardingPage() {
  const session = await getSessionSSR(await headers())
  if (!session?.user) redirect("/auth/signin?callbackUrl=/onboarding")

  // Fetch current profile (gracefully fails if Strapi is unreachable)
  let profile: UserProfile | null = null
  try {
    const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
    const apiToken = process.env.STRAPI_REST_READONLY_API_KEY
    const profileRes = await fetch(
      `${STRAPI}/api/user-profiles?filters[baUserId][$eq]=${encodeURIComponent(session.user.id)}`,
      {
        cache: "no-store",
        headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {},
      }
    )
    if (profileRes.ok) {
      // Strapi v5: fields are flat on the object, no `attributes` wrapper
      const profileJson = (await profileRes.json()) as { data?: UserProfile[] }
      const row = profileJson.data?.[0]
      if (row) profile = row
    }
  } catch {
    // Strapi unavailable — render with empty profile
  }

  // Dynamically import the client shell to keep this RSC lean
  const { OnboardingShell } = await import("./_components/OnboardingShell")

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--t-bg-void)",
        display: "flex",
        flexDirection: "column",
        color: "var(--t-ink-base)",
        fontFamily: "Roboto, sans-serif",
      }}
    >
      <OnboardingShell
        sessionUser={{
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          image: session.user.image ?? null,
        }}
        initialProfile={profile as UserProfile | null}
      />
    </div>
  )
}
