import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"

import BlogLandingPage from "@/components/blog/BlogLandingPage"
import {
  journalHref,
  journalBrowseParams,
  JOURNAL_PAGE_SIZE,
  parseJournalQuery,
} from "@/components/blog/journalLanding.helpers"
import { fetchArticleBrowse } from "@/lib/article-discovery"
import { loadJournalLanding } from "@/lib/journal-landing"
import { buildMetadata, SITE_NAME } from "@/lib/seo/metadata"
import {
  fetchBlogLanding,
  fetchBlogSections,
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
  const [landing, total, sections, tUi, t] = await Promise.all([
    fetchBlogLanding(locale as Locale),
    query.page > 1 || query.section
      ? fetchArticleBrowse("blog", journalBrowseParams(locale, query)).then(
          (result) => result.total
        )
      : Promise.resolve(null),
    query.section
      ? fetchBlogSections(locale as Locale)
      : Promise.resolve({ data: [] }),
    getTranslations({ locale: locale as Locale, namespace: "ui" }),
    getTranslations({ locale: locale as Locale, namespace: "editorial" }),
  ])
  const data = landing?.data
  const emptyPage =
    total !== null &&
    (total === 0 || query.page > Math.ceil(total / JOURNAL_PAGE_SIZE))
  const canonical = journalHref({ ...query, sort: "newest", view: "grid" })
  const pageLabel =
    query.page > 1 ? ` / ${t("pageLabel", { page: query.page })}` : ""
  const sectionLabel =
    sections.data.find((section) => section.slug === query.section)?.name ??
    query.section?.replaceAll("-", " ")
  const cmsTitle = data?.seo?.metaTitle?.trim()

  return buildMetadata({
    seo: {
      ...data?.seo,
      metaTitle: !sectionLabel && cmsTitle ? `${cmsTitle}${pageLabel}` : null,
      metaDescription:
        query.page > 1 || sectionLabel ? null : data?.seo?.metaDescription,
    },
    title: `${sectionLabel ? `${sectionLabel} / ${tUi("journal")}` : t("journalTitle")}${pageLabel}`,
    description:
      query.page > 1 || sectionLabel
        ? t("journalBrowseDescription", {
            section: sectionLabel ?? t("journalStories"),
            page: query.page,
            site: SITE_NAME,
          })
        : t("journalLead"),
    path: canonical,
    locale,
    // Alternate list orders and language selections aren't separate landing pages.
    robots:
      query.sort !== "newest" ||
      query.lang ||
      query.filters ||
      query.allOrigins ||
      emptyPage
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
  setRequestLocale(locale as Locale)
  const data = await loadJournalLanding(
    locale as Locale,
    parseJournalQuery(searchParams)
  )

  return <BlogLandingPage data={data} locale={locale as Locale} />
}
