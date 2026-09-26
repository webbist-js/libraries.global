import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import type { Locale } from "next-intl"

import GlobalHeader from "@/components/global/GlobalHeader"
import { getSessionSSR } from "@/lib/auth-server"
import type { UserProfile } from "@/lib/types/profile"

export const metadata: Metadata = {
  title: "Set up your profile",
  robots: { index: false, follow: false },
}

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const session = await getSessionSSR(await headers())
  if (!session?.user) redirect("/auth/signin?callbackUrl=/profile/onboarding")

  const profile = await (async (): Promise<UserProfile | null> => {
    try {
      const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
      const apiToken = process.env.STRAPI_REST_READONLY_API_KEY
      const res = await fetch(
        `${STRAPI}/api/user-profiles?filters[baUserId][$eq]=${encodeURIComponent(session.user.id)}`,
        {
          cache: "no-store",
          headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {},
        }
      )
      if (!res.ok) return null
      const json = (await res.json()) as { data?: UserProfile[] }

      return json.data?.[0] ?? null
    } catch {
      return null
    }
  })()

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
      <GlobalHeader locale={locale as Locale} />
      <OnboardingShell
        sessionUser={{
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          image: session.user.image ?? null,
        }}
        initialProfile={profile}
      />
    </div>
  )
}
