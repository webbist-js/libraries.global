import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { getTranslations } from "next-intl/server"

import { ProfileTabNav } from "@/app/[locale]/profile/[username]/_components/ProfileTabNav"
import { AccountGuard } from "@/components/auth/AccountGuard"
import { MainContent } from "@/components/ds/MainContent"
import { PageHero } from "@/components/ds/PageHero"
import GlobalHeader from "@/components/global/GlobalHeader"
import { MembershipDashboard } from "@/components/membership/MembershipDashboard"
import { sessionTeamsOf, staffLibrariesOf } from "@/lib/access-server"
import { getContributionSession } from "@/lib/contribution-session-server"
import { redirect } from "@/lib/navigation"
import { fetchOwnProfile } from "@/lib/own-profile-server"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("membershipPage")

  return { title: t("title"), robots: { index: false, follow: false } }
}

export default async function MembershipPage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const [{ locale }, session, t, tUi] = await Promise.all([
    params,
    getContributionSession(),
    getTranslations("membershipPage"),
    getTranslations("ui"),
  ])
  if (!session?.user)
    redirect({ href: "/auth/signin?callbackUrl=/profile/membership", locale })
  const user = session.user
  const { profile, asOf } = await readMembershipData(user)

  return (
    <>
      <GlobalHeader locale={locale} />
      <AccountGuard mode="identity" expectedScope={user.id}>
        <MainContent className="bg-(--t-bg-void) text-(--t-ink-base)">
          <PageHero
            breadcrumb={[
              { label: t("home"), href: "/" },
              { label: tUi("profile"), href: "/profile" },
              { label: t("title") },
            ]}
            eyebrow={t("accountEyebrow")}
            eyebrowIcon="mdi:account-outline"
            title={t("hero")}
            lead={t("lead")}
            tabs={
              profile?.username ? (
                <ProfileTabNav username={profile.username} isOwnProfile />
              ) : undefined
            }
          />
          <MembershipDashboard
            plan={user.plan ?? "free"}
            source={user.planSource ?? "none"}
            teams={sessionTeamsOf(user)}
            asOf={asOf}
            staffCount={staffLibrariesOf(user).length}
            recognition={
              profile
                ? {
                    listed: profile.supporterListed !== false,
                    badgeVisible: profile.supporterBadgeVisible !== false,
                    visibility: profile.profileVisibility ?? "private",
                  }
                : null
            }
          />
        </MainContent>
      </AccountGuard>
    </>
  )
}

async function readMembershipData(user: Parameters<typeof fetchOwnProfile>[0]) {
  const profile = await fetchOwnProfile(user)

  return { profile, asOf: Date.now() }
}
