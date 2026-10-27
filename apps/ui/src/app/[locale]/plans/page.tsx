import { Icon } from "@iconify/react"
import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { getTranslations as getUiTranslations } from "next-intl/server"

import { FreePlansCard } from "@/app/[locale]/contribute/_components/membership/FreePlansCard"
import { LibraryStaffSection } from "@/app/[locale]/contribute/_components/membership/LibraryStaffSection"
import { MembershipPlans } from "@/app/[locale]/contribute/_components/membership/MembershipPlans"
import { MembershipPolicies } from "@/app/[locale]/contribute/_components/membership/MembershipPolicies"
import { PlanCompareTable } from "@/app/[locale]/contribute/_components/membership/PlanCompareTable"
import { MembershipRecognition } from "@/app/[locale]/contribute/_components/membership/PlanStatusBanner"
import { ProFaq } from "@/app/[locale]/contribute/_components/membership/ProFaq"
import { ProFreeRoutes } from "@/app/[locale]/contribute/_components/membership/ProFreeRoutes"
import { AccountGuard } from "@/components/auth/AccountGuard"
import { MainContent } from "@/components/ds/MainContent"
import { PageHero } from "@/components/ds/PageHero"
import { Container } from "@/components/elementary/Container"
import GlobalHeader from "@/components/global/GlobalHeader"
import { PlansAccountStrip } from "@/components/membership/PlansAccountStrip"
import { sessionTeamsOf, staffLibrariesOf } from "@/lib/access-server"
import { authDbPool } from "@/lib/auth"
import { billingConfig } from "@/lib/billing/config"
import { hasManagedMembership } from "@/lib/billing/current-membership"
import { contributionAccountScope } from "@/lib/contribution-account-scope"
import { getContributionSession } from "@/lib/contribution-session-server"
import { T } from "@/lib/design-tokens"
import { buildMetadata } from "@/lib/seo/metadata"

// Public pricing has its own canonical URL, separate from private account management.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>
}): Promise<Metadata> {
  const { locale } = await params

  const m = await getUiTranslations({
    locale,
    namespace: "membershipContent.copy",
  })

  return buildMetadata({
    title: (await getUiTranslations({ locale, namespace: "membershipPage" }))(
      "plansTitle"
    ),
    description: m("metaDescription"),
    path: "plans",
    locale,
  })
}

export default async function PlansPage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  const t = await getUiTranslations("membershipPage")
  const m = await getUiTranslations("membershipContent.copy")
  const PROMISES = [m("promiseAds"), m("promiseTrust"), m("promiseData")]

  const session = await getContributionSession()
  const user = session?.user
  // A signed-in session missing its plan counts as free (missing means deny).
  const currentPlan = user ? (user.plan ?? "free") : "public"
  // Staff of at least one library go to the staff area; anyone else to the
  // claim flow (signed out, the claim page asks them to sign in).
  const isStaff = staffLibrariesOf(user).length > 0
  const hasPaidMembership =
    user && billingConfig().configured
      ? await hasManagedMembership(authDbPool, user.id)
      : false

  return (
    <>
      <GlobalHeader locale={locale} />
      <AccountGuard
        expectedScope={contributionAccountScope(user)}
        publicGuestPaths={["/plans"]}
      >
        <MainContent style={{ background: T.bg.void, color: T.ink.base }}>
          <PageHero
            breadcrumb={[
              { label: t("home"), href: "/" },
              { label: t("plansTitle") },
            ]}
            eyebrow={t("plansEyebrow")}
            eyebrowIcon="mdi:sparkles"
            title={t("plansHero")}
            lead={m("lead")}
          >
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {PROMISES.map((text) => (
                <li
                  key={text}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold"
                  style={{ background: T.bg.deep, borderColor: T.border.line }}
                >
                  <Icon
                    aria-hidden="true"
                    height={15}
                    icon="mdi:check"
                    style={{ color: T.accent.ok }}
                    width={15}
                  />
                  {text}
                </li>
              ))}
            </ul>
          </PageHero>

          <Container className="flex flex-col gap-12 py-10 sm:gap-16 sm:py-14">
            {user ? (
              <PlansAccountStrip
                plan={user.plan ?? "free"}
                source={user.planSource}
              />
            ) : null}
            <FreePlansCard signedIn={Boolean(user)} />
            <LibraryStaffSection isStaff={isStaff} compact />
            <div className="flex flex-col gap-5">
              <MembershipPlans
                teams={sessionTeamsOf(user)}
                currentPlan={currentPlan}
                billingAvailable={billingConfig().enabled}
                supporterApproved={billingConfig().supporterApproved}
                checkoutUser={
                  user
                    ? {
                        email: user.email,
                        verified: user.emailVerified,
                        hasPaidMembership,
                        complimentaryPro:
                          ["pro", "team"].includes(user.plan ?? "") &&
                          user.planSource !== "paid",
                      }
                    : null
                }
              />
            </div>
            <PlanCompareTable currentPlan={currentPlan} />
            <div className="flex flex-col gap-6">
              <ProFreeRoutes />
              {currentPlan !== "supporter" &&
              currentPlan !== "pro" &&
              currentPlan !== "team" ? (
                <MembershipRecognition />
              ) : null}
            </div>
            <ProFaq />
            <MembershipPolicies />
          </Container>
        </MainContent>
      </AccountGuard>
    </>
  )
}
