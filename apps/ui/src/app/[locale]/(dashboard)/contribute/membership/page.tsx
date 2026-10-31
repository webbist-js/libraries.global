import type { Locale } from "next-intl"
import { getTranslations } from "next-intl/server"

import { MembershipDashboard } from "@/components/membership/MembershipDashboard"
import { sessionTeamsOf, staffLibrariesOf } from "@/lib/access-server"
import { getContributionSession } from "@/lib/contribution-session-server"
import { readMembershipData } from "@/lib/membership-page-server"
import { redirect } from "@/lib/navigation"

import { ContributeSectionHeader } from "../_components/ContributeSectionHeader"

export async function generateMetadata() {
  const t = await getTranslations("membershipPage")

  return { title: t("title"), robots: { index: false, follow: false } }
}

/** The same live billing and recognition controls used by the profile drawer. */
export default async function ContributionMembershipPage({
  params,
}: {
  readonly params: Promise<{ locale: Locale }>
}) {
  const [{ locale }, session, t] = await Promise.all([
    params,
    getContributionSession(),
    getTranslations("membershipPage"),
  ])
  if (!session?.user)
    redirect({
      href: "/auth/signin?callbackUrl=/contribute/membership",
      locale,
    })
  const user = session.user
  const { profile, asOf } = await readMembershipData(user)

  return (
    <>
      <ContributeSectionHeader
        section={t("title")}
        title={t("hero")}
        lead={t("lead")}
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
    </>
  )
}
