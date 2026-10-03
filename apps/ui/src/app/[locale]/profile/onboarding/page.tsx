import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import type { Locale } from "next-intl"

import GlobalHeader from "@/components/global/GlobalHeader"
import { getSessionSSR } from "@/lib/auth-server"
import { fetchOwnProfile } from "@/lib/own-profile-server"

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

  // No username yet, so the profile is read by the session's Better Auth id
  // through the bridge (`baUserId` is private).
  const profile = await fetchOwnProfile(session.user)

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
