import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { getSessionSSR } from "@/lib/auth-server"

export default async function OnboardingPage() {
  const session = await getSessionSSR(await headers())
  if (!session?.user) redirect("/auth/signin?callbackUrl=/onboarding")

  // Fetch current profile
  const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  const profileRes = await fetch(
    `${STRAPI}/api/user-profiles?filters[baUserId][$eq]=${encodeURIComponent(session.user.id)}&publicationState=live`,
    { next: { revalidate: 0 } }
  )
  const profileJson = profileRes.ok
    ? ((await profileRes.json()) as {
        data?: { id: number; attributes?: Record<string, unknown> }[]
      })
    : { data: [] }
  const row = profileJson.data?.[0]
  const profile = row ? { id: row.id, ...row.attributes } : null

  // Dynamically import the client shell to keep this RSC lean
  const { OnboardingShell } = await import("./_components/OnboardingShell")

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#030511",
        display: "flex",
        flexDirection: "column",
        color: "#f4f7ff",
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
        initialProfile={profile as any}
      />
    </div>
  )
}
