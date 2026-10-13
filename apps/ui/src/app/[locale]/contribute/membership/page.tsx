import { Icon } from "@iconify/react"
import type { Metadata } from "next"
import { headers } from "next/headers"
import { getTranslations as getUiTranslations } from "next-intl/server"

import { Container } from "@/components/elementary/Container"
import GlobalLink from "@/components/global/GlobalLink"
import { staffLibrariesOf } from "@/lib/access-server"
import { authDbPool } from "@/lib/auth"
import { getSessionSSR } from "@/lib/auth-server"
import { billingConfig } from "@/lib/billing/config"
import { hasManagedMembership } from "@/lib/billing/current-membership"
import { T } from "@/lib/design-tokens"
import { buildMetadata } from "@/lib/seo/metadata"

import { ContributeSectionHeader } from "../_components/ContributeSectionHeader"
import { FreePlansCard } from "../_components/membership/FreePlansCard"
import { LibraryStaffSection } from "../_components/membership/LibraryStaffSection"
import { MembershipPlans } from "../_components/membership/MembershipPlans"
import { MembershipPolicies } from "../_components/membership/MembershipPolicies"
import { PlanCompareTable } from "../_components/membership/PlanCompareTable"
import { PlanStatusBanner } from "../_components/membership/PlanStatusBanner"
import { ProFaq } from "../_components/membership/ProFaq"
import { ProFreeRoutes } from "../_components/membership/ProFreeRoutes"

// Public and indexable, unlike the rest of /contribute (see layout.tsx).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params

  return buildMetadata({
    title: "Plans and Pro",
    description:
      "Library facts are free, always. Membership keeps the index running; Pro and Team add Library access population comparisons and other analysis tools. See the plans and the ways to get Pro free.",
    path: "contribute/membership",
    locale,
  })
}

const PROMISES = [
  "No ads, ever",
  "Money never buys trust",
  "Pro is free for contributors",
]

export default async function MembershipPage() {
  const tUi = await getUiTranslations("ui")

  const session = await getSessionSSR(await headers())
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
    <main style={{ background: T.bg.void, color: T.ink.base }}>
      <ContributeSectionHeader
        section={tUi("membership")}
        title="Plans and *Pro*"
        lead="Library facts are free, always. Membership keeps the index running; Pro and Team add Library access population comparisons and other analysis tools."
      >
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {PROMISES.map((text) => (
            <li
              key={text}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13.5px] font-semibold"
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
      </ContributeSectionHeader>

      <Container className="flex flex-col gap-16 py-12 sm:gap-20 sm:py-16">
        <PlanStatusBanner plan={user?.plan} planSource={user?.planSource} />
        <FreePlansCard signedIn={Boolean(user)} />
        <LibraryStaffSection isStaff={isStaff} />
        <MembershipPlans
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
        <MembershipPolicies />
        <p
          className="m-0 text-[16px] leading-relaxed"
          style={{ color: T.ink.dim }}
        >
          Supporter, Pro and Team members can choose an optional profile mark
          and public credit.{" "}
          <GlobalLink
            href="/community/supporters"
            className="font-semibold underline underline-offset-4"
            style={{ color: T.accent.primary }}
          >
            Meet the supporters
          </GlobalLink>
          . Both visibility choices are in your profile settings.
        </p>
        <PlanCompareTable />
        <ProFreeRoutes />
        <ProFaq />
      </Container>
    </main>
  )
}
