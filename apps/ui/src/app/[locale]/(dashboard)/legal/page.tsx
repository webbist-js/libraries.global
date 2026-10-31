import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { getTranslations } from "next-intl/server"

import LegalIndexPage from "@/components/legal/LegalIndexPage"
import { buildMetadata } from "@/lib/seo/metadata"
import { fetchLegalDocuments } from "@/lib/strapi-api/content/server"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale: locale as Locale, namespace: "ui" })

  return buildMetadata({
    title: t("legal_policies"),
    description: t("legal_policies_intro"),
    path: "legal",
    locale,
  })
}

/** One stable destination for all published policies, in the CMS's order. */
export default async function LegalIndexRoute({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const locale = (await params).locale as Locale
  const documents = (await fetchLegalDocuments(locale, "published")).data

  return <LegalIndexPage locale={locale} documents={documents} />
}
