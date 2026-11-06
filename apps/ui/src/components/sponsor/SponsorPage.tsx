import { useTranslations } from "next-intl"

import { DashboardSidebarCta } from "@/components/dashboard/DashboardSidebarCta"
import { InformationPage } from "@/components/dashboard/InformationPage"
import { MainContent } from "@/components/ds/MainContent"
import { PageHero } from "@/components/ds/PageHero"
import { Container } from "@/components/elementary/Container"
import type { SponsorAcknowledgements } from "@/lib/sponsor/acknowledgements"

import {
  SponsorAcknowledgementList,
  SponsorContactButton,
  SponsorEnquiry,
  SponsorProgrammes,
  SponsorRecognition,
} from "./SponsorSections"

/**
 * Public sponsorship information. Sponsor records feed this page only; they
 * never reach entitlements, ranking, verification or moderation.
 */
export function SponsorPage({
  acknowledgements,
}: {
  readonly acknowledgements: SponsorAcknowledgements
}) {
  const t = useTranslations("sponsorPage")

  return (
    <InformationPage
      title={t("title")}
      className="sponsor-page"
      links={[
        { href: "#programmes", label: t("nav.programmes") },
        { href: "#recognition", label: t("nav.recognition") },
        { href: "#independence", label: t("nav.independence") },
        { href: "#sponsors", label: t("nav.sponsors") },
        { href: "#enquire", label: t("nav.enquire") },
      ]}
      navigationFooter={
        <DashboardSidebarCta
          title={t("sidebar.title")}
          body={t("sidebar.body")}
          action={{ href: "#enquire", label: t("sidebar.action") }}
          secondary={{ href: "/developers", label: t("sidebar.api") }}
        />
      }
    >
      <MainContent>
        <PageHero
          variant="card"
          eyebrow={t("eyebrow")}
          eyebrowIcon="mdi:handshake-outline"
          title={t("heroTitle")}
          lead={t("lead")}
        >
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <SponsorContactButton label={t("enquire.action")} />
            <a
              href="#enquire"
              className="inline-flex min-h-11 items-center text-base font-semibold text-(--t-accent-primary) underline underline-offset-4"
            >
              {t("heroHow")}
            </a>
          </div>
        </PageHero>
        <Container className="flex flex-col gap-14 py-10 sm:py-14">
          <SponsorProgrammes />
          <SponsorRecognition />
          <SponsorAcknowledgementList acknowledgements={acknowledgements} />
          <SponsorEnquiry />
        </Container>
      </MainContent>
    </InformationPage>
  )
}

export default SponsorPage
