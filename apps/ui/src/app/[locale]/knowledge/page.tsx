import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { use } from "react"

import { toDocsSections } from "@/components/docs/docs.config"
import DocsPage from "@/components/docs/DocsPage"
import { buildMetadata, SITE_NAME } from "@/lib/seo/metadata"
import {
  fetchDocsWikiArticles,
  fetchWikiLanding,
  fetchWikiSections,
} from "@/lib/strapi-api/content/server"

export const dynamic = "force-static"
export const revalidate = 300

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const [tUi, tArticle] = await Promise.all([
    getTranslations({ locale: locale as Locale, namespace: "ui" }),
    getTranslations({ locale: locale as Locale, namespace: "editorial" }),
  ])

  return buildMetadata({
    title: tUi("knowledge"),
    description: tArticle("knowledgeDescription", { site: SITE_NAME }),
    path: "knowledge",
    locale,
  })
}

export default function DocsRoute(props: {
  params: Promise<{ locale: string }>
}) {
  const params = use(props.params)
  const locale = params.locale as Locale
  setRequestLocale(locale)

  const [articlesRes, sectionsRes, landingRes] = use(
    Promise.all([
      fetchDocsWikiArticles(locale),
      fetchWikiSections(locale as Locale),
      fetchWikiLanding(locale),
    ])
  )

  return (
    <DocsPage
      articles={articlesRes?.data ?? []}
      locale={locale}
      landing={landingRes?.data}
      quickStartCards={landingRes?.data?.quickStartCards}
      sections={toDocsSections(sectionsRes.data)}
    />
  )
}
