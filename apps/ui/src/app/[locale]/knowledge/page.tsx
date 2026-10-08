import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { use } from "react"

import { toDocsSections } from "@/components/docs/docs.config"
import DocsPage from "@/components/docs/DocsPage"
import { buildMetadata, SITE_NAME } from "@/lib/seo/metadata"
import {
  fetchDocsWikiArticles,
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

  return buildMetadata({
    title: "Knowledge base",
    description: `How to improve library records, run the platform locally, use the open data, and build on the ${SITE_NAME} design system.`,
    path: "knowledge",
    locale,
  })
}

export default function DocsRoute(props: {
  params: Promise<{ locale: string }>
}) {
  const params = use(props.params)
  const locale = params.locale as Locale

  const [articlesRes, sectionsRes] = use(
    Promise.all([fetchDocsWikiArticles(locale), fetchWikiSections()])
  )

  return (
    <DocsPage
      articles={articlesRes?.data ?? []}
      locale={locale}
      sections={toDocsSections(sectionsRes.data)}
    />
  )
}
