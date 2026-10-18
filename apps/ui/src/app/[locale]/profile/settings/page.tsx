import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import type { Locale } from "next-intl"
import { getTranslations as getUiTranslations } from "next-intl/server"

import { ProfileHero } from "@/app/[locale]/profile/[username]/_components/ProfileHero"
import { ProfileTabNav } from "@/app/[locale]/profile/[username]/_components/ProfileTabNav"
import { AccountGuard } from "@/components/auth/AccountGuard"
import { PageHero } from "@/components/ds"
import GlobalHeader from "@/components/global/GlobalHeader"
import { getSessionSSR } from "@/lib/auth-server"
import { avatarSrc } from "@/lib/avatar"
import { T } from "@/lib/design-tokens"
import { fetchOwnProfile } from "@/lib/own-profile-server"

import { SettingsShell } from "./_components/SettingsShell"

export const metadata: Metadata = {
  title: "Profile settings",
  robots: { index: false, follow: false },
}

export default async function ProfileSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const tUi = await getUiTranslations("ui")

  const [{ locale }, hdrs] = await Promise.all([params, headers()])

  const session = await getSessionSSR(hdrs)

  if (!session?.user) redirect("/auth/signin?callbackUrl=/profile/settings")

  // Owner view through the bridge: `baUserId` is private, so the public
  // REST filter on it can't find the profile.
  const profile = await fetchOwnProfile(session.user)
  const username = profile?.username ?? null
  // The title reads `*italic*` markup, so a name can't add its own.
  const name = (
    profile?.firstName ||
    session.user.name?.split(" ")[0] ||
    "there"
  ).replaceAll("*", "")

  return (
    <>
      <GlobalHeader locale={locale as Locale} />
      <AccountGuard mode="identity" expectedScope={session.user.id}>
        <div
          className="relative isolate flex min-h-screen w-full flex-col"
          style={{ background: T.bg.void, color: T.ink.base }}
        >
          {profile && username ? (
            <ProfileHero
              profile={profile}
              isOwnProfile
              isSignedIn
              tabs={<ProfileTabNav username={username} isOwnProfile />}
            />
          ) : (
            <PageHero
              compact
              breadcrumb={[
                { label: tUi("home"), href: "/" },
                { label: tUi("settings") },
              ]}
              eyebrow="Account settings"
              eyebrowIcon="mdi:cog-outline"
              title={`Welcome back, *${name}.*`}
              lead="Your public profile, who can see it, what we email you about, and your account."
            />
          )}
          <SettingsShell
            profile={profile}
            sessionUser={session.user}
            avatarUrl={avatarSrc(profile?.avatar)}
            imageUploadsEnabled={Boolean(process.env.STRAPI_UPLOAD_API_KEY)}
          />
        </div>
      </AccountGuard>
    </>
  )
}
