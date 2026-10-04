import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import type { Locale } from "next-intl"

import { PageHero } from "@/components/ds"
import GlobalHeader from "@/components/global/GlobalHeader"
import { getSessionSSR } from "@/lib/auth-server"
import { avatarSrc } from "@/lib/avatar"
import { T } from "@/lib/design-tokens"
import { fetchOwnProfile } from "@/lib/own-profile-server"

import { OnboardingShell } from "./_components/OnboardingShell"

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

  return (
    <>
      <GlobalHeader locale={locale as Locale} />
      <div
        className="relative isolate flex min-h-screen w-full flex-col"
        style={{ background: T.bg.void, color: T.ink.base }}
      >
        <PageHero
          compact
          eyebrow="Profile setup"
          eyebrowIcon="mdi:account-circle-outline"
          title="One last thing — *introduce yourself.*"
          lead="Every contributor on the atlas has a public profile. It’s how readers, editors and reviewers know who’s behind a record. Only the Required sections are needed now; the rest can wait."
        />
        <OnboardingShell
          sessionUser={{
            id: session.user.id,
            name: session.user.name,
            email: session.user.email,
            image: session.user.image ?? null,
          }}
          initialProfile={profile}
          avatarUrl={avatarSrc(profile?.avatar)}
        />
      </div>
    </>
  )
}
