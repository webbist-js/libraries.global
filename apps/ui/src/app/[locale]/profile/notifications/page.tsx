import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import type { Locale } from "next-intl"
import { getTranslations as getUiTranslations } from "next-intl/server"

import { ProfileHero } from "@/app/[locale]/profile/[username]/_components/ProfileHero"
import { ProfileTabNav } from "@/app/[locale]/profile/[username]/_components/ProfileTabNav"
import { AccountGuard } from "@/components/auth/AccountGuard"
import { PageHero } from "@/components/ds"
import { MainContent } from "@/components/ds/MainContent"
import GlobalHeader from "@/components/global/GlobalHeader"
import { NotificationInbox } from "@/components/notifications/NotificationInbox"
import { getSessionSSR } from "@/lib/auth-server"
import { fetchOwnProfile } from "@/lib/own-profile-server"

export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
}
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const tUi = await getUiTranslations("ui")

  const [session, { locale }] = await Promise.all([
    getSessionSSR(await headers()),
    params,
  ])
  if (!session?.user)
    redirect("/auth/signin?callbackUrl=/profile/notifications")
  const profile = await fetchOwnProfile(session.user)

  return (
    <>
      <GlobalHeader locale={locale as Locale} />
      <AccountGuard mode="identity" expectedScope={session.user.id}>
        <div className="relative isolate flex min-h-screen w-full flex-col bg-(--t-bg-void) text-(--t-ink-base)">
          {profile?.username ? (
            <ProfileHero
              profile={profile}
              isOwnProfile
              isSignedIn
              tabs={<ProfileTabNav username={profile.username} isOwnProfile />}
            />
          ) : (
            <PageHero
              compact
              breadcrumb={[
                { label: tUi("home"), href: "/" },
                { label: tUi("notifications") },
              ]}
              eyebrow="Your account"
              eyebrowIcon="mdi:bell-outline"
              title="Your *notifications.*"
              lead="Updates about your contributions, libraries and community."
            />
          )}
          <MainContent className="mx-auto w-full max-w-[1360px] px-4 pt-8 pb-20 sm:px-8">
            <NotificationInbox />
          </MainContent>
        </div>
      </AccountGuard>
    </>
  )
}
