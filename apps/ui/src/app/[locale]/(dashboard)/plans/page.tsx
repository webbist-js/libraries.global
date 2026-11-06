import { Icon } from "@iconify/react"
import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { getTranslations as getUiTranslations } from "next-intl/server"

import { LibraryStaffSection } from "@/app/[locale]/(dashboard)/contribute/_components/membership/LibraryStaffSection"
import { MembershipPolicies } from "@/app/[locale]/(dashboard)/contribute/_components/membership/MembershipPolicies"
import {
  heldOffers,
  OfferCards,
  type OfferViewer,
} from "@/app/[locale]/(dashboard)/contribute/_components/membership/OfferCards"
import { PlanCompareTable } from "@/app/[locale]/(dashboard)/contribute/_components/membership/PlanCompareTable"
import { ProFaq } from "@/app/[locale]/(dashboard)/contribute/_components/membership/ProFaq"
import { SupporterMilestone } from "@/app/[locale]/(dashboard)/contribute/_components/membership/SupporterMilestone"
import { AccountGuard } from "@/components/auth/AccountGuard"
import { DashboardSidebarCta } from "@/components/dashboard/DashboardSidebarCta"
import { InformationPage } from "@/components/dashboard/InformationPage"
import { MainContent } from "@/components/ds/MainContent"
import { PageHero } from "@/components/ds/PageHero"
import { Container } from "@/components/elementary/Container"
import { PlansAccountStrip } from "@/components/membership/PlansAccountStrip"
import { hasFact, staffLibrariesOf } from "@/lib/access-server"
import { contributionAccountScope } from "@/lib/contribution-account-scope"
import { getContributionSession } from "@/lib/contribution-session-server"
import { T } from "@/lib/design-tokens"
import type { CompareColumn } from "@/lib/plan-compare"
import { offerValues } from "@/lib/plans"
import { fetchRoadmap } from "@/lib/roadmap-server"
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
    description: m("metaDescription", offerValues(locale)),
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
  const PROMISES = [m("promiseAds"), m("promiseTrust"), m("promiseData")]

  // Rows for unbuilt features link to their Roadmap item while it's listed.
  const roadmap = await fetchRoadmap(locale).catch(() => null)
  const roadmapKeys = roadmap?.features.map((feature) => feature.key) ?? []

  const session = await getContributionSession()
  const user = session?.user
  const viewer: OfferViewer = {
    signedIn: Boolean(user),
    standing: user ? String(user.standing ?? "explorer") : "public",
    // Staff of at least one library go to the staff area; anyone else to the
    // claim flow (signed out, the claim page asks them to sign in).
    isStaff: staffLibrariesOf(user).length > 0,
    hasApi: hasFact(user, "apiCustomer"),
  }
  const held = heldOffers(viewer)
  const heldColumns: CompareColumn[] = user
    ? (["explorer", "contributor", "staff", "api"] as const).filter((key) =>
        held.has(key)
      )
    : ["public"]

  return (
    <InformationPage
      title={t("plansTitle")}
      className="dashboard-plans-page"
      links={[
        { href: "#offers", label: t("offersNav") },
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
                standing={viewer.standing}
                acceptedContributions={
                  Number.isSafeInteger(user.acceptedContributions)
                    ? Number(user.acceptedContributions)
                    : 0
                }
                recentlyActive={user.recentlyActive === true}
              />
            ) : null}
            <section id="offers" className="scroll-mt-24">
              <OfferCards viewer={viewer} />
            </section>
            <SupporterMilestone />
            <LibraryStaffSection isStaff={viewer.isStaff} compact />
            <section id="plan-comparison">
              <PlanCompareTable held={heldColumns} roadmapKeys={roadmapKeys} />
            </section>
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
