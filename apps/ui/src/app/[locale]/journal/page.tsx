import type { Metadata } from "next"
import type { Locale } from "next-intl"

import BlogLandingPage from "@/components/blog/BlogLandingPage"
import {
  journalHref,
  JOURNAL_PAGE_SIZE,
  parseJournalQuery,
} from "@/components/blog/journalLanding.helpers"
import { loadJournalLanding } from "@/lib/journal-landing"
import { buildMetadata } from "@/lib/seo/metadata"
import {
  countJournalArticles,
  fetchBlogLanding,
} from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

// Section, sort, page, view and language live in the URL, so the page renders
// per request; the Strapi fetches underneath stay cached.
export const revalidate = 300

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<Metadata> {
  const { locale } = await params
  const query = parseJournalQuery(await searchParams)
  const [landing, total] = await Promise.all([
    fetchBlogLanding(locale as Locale),
    query.page > 1 || query.section
      ? countJournalArticles(locale, query.section)
      : Promise.resolve(null),
  ])
  const data = landing?.data
  const emptyPage =
    total !== null &&
    (total === 0 || query.page > Math.ceil(total / JOURNAL_PAGE_SIZE))
  const canonical = journalHref({ ...query, sort: "newest", view: "grid" })
  const pageLabel = query.page > 1 ? ` / Page ${query.page}` : ""
  const sectionLabel = query.section?.replaceAll("-", " ")
  const cmsTitle = data?.seo?.metaTitle?.trim()

  return buildMetadata({
    seo: {
      ...data?.seo,
      metaTitle: !sectionLabel && cmsTitle ? `${cmsTitle}${pageLabel}` : null,
      metaDescription:
        query.page > 1 || sectionLabel ? null : data?.seo?.metaDescription,
    },
    title: `${sectionLabel ? `${sectionLabel} / Journal` : "Library stories and research / Journal"}${pageLabel}`,
    description:
      query.page > 1 || sectionLabel
        ? `Browse ${sectionLabel ? `${sectionLabel} articles` : "library stories and research"}${query.page > 1 ? ` on page ${query.page}` : ""} of the Libraries Global Journal.`
        : "Stories, research and editorial from the global libraries community — library history, collections and the people who run them.",
    path: canonical,
    locale,
    // Alternate list orders and language selections aren't separate landing pages.
    robots:
      query.sort !== "newest" || query.lang || emptyPage
        ? "noindex-follow"
        : "index",
    image: formatStrapiMediaUrl(data?.seo?.metaImage?.url),
  })
}

export default async function BlogPage(props: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ locale }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ])
  const data = await loadJournalLanding(
    locale as Locale,
    parseJournalQuery(searchParams)
  )

  return <BlogLandingPage data={data} locale={locale as Locale} />
}
