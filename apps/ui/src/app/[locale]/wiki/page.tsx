import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { use } from "react"

import WikiLandingPage from "@/components/wiki/WikiLandingPage"
import {
  fetchPopularWikiArticles,
  fetchWikiLanding,
  fetchWikiNavigation,
  fetchWikiSections,
  fetchWikiTopContributors,
} from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

export const dynamic = "force-static"
export const revalidate = 300

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const data = (await fetchWikiLanding(locale as Locale))?.data

  const title = data?.seo?.metaTitle ?? "Wiki"
  const description =
    data?.seo?.metaDescription ??
    "Explore the libraries knowledge hub — reference articles, guides, and documentation."
  const ogImageUrl = data?.seo?.metaImage?.url
    ? formatStrapiMediaUrl(data.seo.metaImage.url)
    : undefined

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      ...(ogImageUrl ? { images: [{ url: ogImageUrl }] } : {}),
    },
  }
}

export default function WikiPage(props: {
  params: Promise<{ locale: string }>
}) {
  const params = use(props.params)
  const locale = params.locale as Locale

  const landing = use(fetchWikiLanding(locale))?.data ?? null
  const articles = use(fetchPopularWikiArticles(locale))?.data ?? []
  const navCategories = use(fetchWikiNavigation(locale))?.data ?? []
  const wikiSections = use(fetchWikiSections(locale))?.data ?? []
  const topContributors = use(fetchWikiTopContributors())?.data ?? []

  return (
    <WikiLandingPage
      landing={landing}
      articles={articles}
      navCategories={navCategories}
      wikiSections={wikiSections}
      topContributors={topContributors}
      locale={locale}
    />
  )
}
