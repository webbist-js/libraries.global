import type { Metadata } from "next"
import type { Locale } from "next-intl"

import BlogLandingPage from "@/components/blog/BlogLandingPage"
import { parseJournalQuery } from "@/components/blog/journalLanding.helpers"
import { loadJournalLanding } from "@/lib/journal-landing"
import { buildMetadata } from "@/lib/seo/metadata"
import { fetchBlogLanding } from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

// Section, sort, page, view and language live in the URL, so the page renders
// per request; the Strapi fetches underneath stay cached.
export const revalidate = 300

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const data = (await fetchBlogLanding(locale as Locale))?.data

  return buildMetadata({
    title: data?.seo?.metaTitle ?? "Journal",
    description:
      data?.seo?.metaDescription ??
      "Stories, research and editorial from the global libraries community — library history, collections and the people who run them.",
    path: "journal",
    locale,
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
