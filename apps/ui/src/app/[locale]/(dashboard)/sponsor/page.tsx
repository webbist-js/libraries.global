import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { SponsorPage } from "@/components/sponsor/SponsorPage"
import { withMessages } from "@/i18n/scoped-messages"
import { buildMetadata } from "@/lib/seo/metadata"
import { fetchSponsorAcknowledgements } from "@/lib/sponsor/acknowledgements-server"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "sponsorPage" })

  return buildMetadata({
    title: t("metaTitle"),
    description: t("metaDescription"),
    path: "sponsor",
    locale,
  })
}

async function SponsorRoute({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const acknowledgements = await fetchSponsorAcknowledgements()

  return <SponsorPage acknowledgements={acknowledgements} />
}

export default withMessages(SponsorRoute, "[locale]/(dashboard)/sponsor/page")
