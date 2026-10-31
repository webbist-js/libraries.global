import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { AccountGuard } from "@/components/auth/AccountGuard"
import { DashboardPage } from "@/components/dashboard/DashboardPage"
import { DashboardSidebarCta } from "@/components/dashboard/DashboardSidebarCta"
import { InformationNavigation } from "@/components/dashboard/InformationNavigation"
import { RecordContextIdentity } from "@/components/dashboard/RecordContextIdentity"
import { RecordToolbar } from "@/components/dashboard/RecordToolbar"
import { PageHero } from "@/components/ds"
import { getSessionSSR } from "@/lib/auth-server"
import { avatarSrc } from "@/lib/avatar"
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
  await params
  const sections = [
    { href: "#identity", label: "Name and identity" },
    { href: "#affiliation", label: "Affiliation" },
    { href: "#interests", label: "Interests and languages" },
    { href: "#links", label: "Links" },
    { href: "#visibility", label: "Profile visibility" },
  ]
  const session = await getSessionSSR(await headers())
  if (!session?.user) redirect("/auth/signin?callbackUrl=/profile/onboarding")

  // No username yet, so the profile is read by the session's Better Auth id
  // through the bridge (`baUserId` is private).
  const profile = await fetchOwnProfile(session.user)

  return (
    <AccountGuard mode="identity" expectedScope={session.user.id}>
      <DashboardPage
        title="Profile setup"
        className="dashboard-onboarding-page dashboard-record-page"
        navigationHeading={
          <RecordContextIdentity
            title="Profile setup"
            parent={{ href: "/", label: "Home" }}
          />
        }
        navigation={
          <InformationNavigation links={sections} label="Set up your profile" />
        }
        navigationFooter={
          <DashboardSidebarCta
            title="Your profile, your choice"
            body="Only the required fields are needed now. You can change your visibility at any time."
            action={{ href: "#visibility", label: "Review profile visibility" }}
          />
        }
        toolbar={
          <RecordToolbar
            items={[{ href: "/", label: "Home" }, { label: "Profile setup" }]}
          />
        }
        mobileSections={sections}
      >
        <div className="onboarding-page-content">
          <PageHero
            variant="card"
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
            imageUploadsEnabled={Boolean(process.env.STRAPI_UPLOAD_API_KEY)}
          />
        </div>
      </DashboardPage>
    </AccountGuard>
  )
}
