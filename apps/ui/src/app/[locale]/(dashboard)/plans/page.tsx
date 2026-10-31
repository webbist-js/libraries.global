import { Icon } from "@iconify/react"
import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { getTranslations as getUiTranslations } from "next-intl/server"

import { FreePlansCard } from "@/app/[locale]/(dashboard)/contribute/_components/membership/FreePlansCard"
import { LibraryStaffSection } from "@/app/[locale]/(dashboard)/contribute/_components/membership/LibraryStaffSection"
import { MembershipPlans } from "@/app/[locale]/(dashboard)/contribute/_components/membership/MembershipPlans"
import { MembershipPolicies } from "@/app/[locale]/(dashboard)/contribute/_components/membership/MembershipPolicies"
import { PlanCompareTable } from "@/app/[locale]/(dashboard)/contribute/_components/membership/PlanCompareTable"
import { MembershipRecognition } from "@/app/[locale]/(dashboard)/contribute/_components/membership/PlanStatusBanner"
import { ProFaq } from "@/app/[locale]/(dashboard)/contribute/_components/membership/ProFaq"
import { ProFreeRoutes } from "@/app/[locale]/(dashboard)/contribute/_components/membership/ProFreeRoutes"
import { AccountGuard } from "@/components/auth/AccountGuard"
import { DashboardSidebarCta } from "@/components/dashboard/DashboardSidebarCta"
import { InformationPage } from "@/components/dashboard/InformationPage"
import { MainContent } from "@/components/ds/MainContent"
import { PageHero } from "@/components/ds/PageHero"
import { Container } from "@/components/elementary/Container"
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
  const t = await getUiTranslations({ locale, namespace: "membershipPage" })
  const m = await getUiTranslations({
    locale,
    namespace: "membershipContent.copy",
  })
  const ui = await getUiTranslations({ locale, namespace: "ui" })
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
    <InformationPage
      title={t("plansTitle")}
      className="dashboard-plans-page"
      links={[
        { href: "#free-plans", label: ui("free_for_everyone") },
        { href: "#membership-options", label: ui("choose_your_membership") },
        { href: "#plan-comparison", label: t("comparePlans") },
        { href: "#plan-questions", label: t("questionsPoliciesNav") },
      ]}
      navigationFooter={
        <DashboardSidebarCta
          title={t("membershipQuestions")}
          body={t("plansHelpLead")}
          action={{ href: "#plan-comparison", label: t("comparePlans") }}
          secondary={{
            href: "mailto:info@libraries.global",
            label: t("askQuestion"),
          }}
        />
      }
    >
      <AccountGuard
        expectedScope={contributionAccountScope(user)}
        publicGuestPaths={["/plans"]}
      >
        <MainContent className="plans-page-content">
          <PageHero
            variant="card"
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

          <Container className="plans-sections">
            {user ? (
              <PlansAccountStrip
                plan={user.plan ?? "free"}
                source={user.planSource}
              />
            ) : null}
            <section id="free-plans">
              <FreePlansCard signedIn={Boolean(user)} />
            </section>
            <LibraryStaffSection isStaff={isStaff} compact />
            <div id="membership-options" className="flex flex-col gap-5">
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
            <section id="plan-comparison">
              <PlanCompareTable currentPlan={currentPlan} />
            </section>
            <div className="flex flex-col gap-6">
              <ProFreeRoutes />
              {currentPlan !== "supporter" &&
              currentPlan !== "pro" &&
              currentPlan !== "team" ? (
                <MembershipRecognition />
              ) : null}
            </div>
            <section id="plan-questions" className="space-y-8">
              <ProFaq />
              <MembershipPolicies />
            </section>
          </Container>
        </MainContent>
      </AccountGuard>
    </InformationPage>
  )
}
