import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { use } from "react"

import BlogLandingPage from "@/components/blog/BlogLandingPage"
import { buildMetadata } from "@/lib/seo/metadata"
import {
  fetchBlogLanding,
  fetchBlogSections,
  fetchRecentBlogArticles,
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
  const data = (await fetchBlogLanding(locale as Locale))?.data

  return buildMetadata({
    title: data?.seo?.metaTitle ?? "Blog",
    description:
      data?.seo?.metaDescription ??
      "Stories, research and editorial from the global libraries community — library history, collections and the people who run them.",
    path: "blog",
    locale,
    image: formatStrapiMediaUrl(data?.seo?.metaImage?.url),
  })
}

export default function BlogPage(props: {
  params: Promise<{ locale: string }>
}) {
  const params = use(props.params)
  const locale = params.locale as Locale

  const landing = use(fetchBlogLanding(locale))?.data ?? null
  const articles = use(fetchRecentBlogArticles(locale))?.data ?? []
  const sections = use(fetchBlogSections())?.data ?? []

  return (
    <BlogLandingPage
      landing={landing}
      articles={articles}
      sections={sections}
      locale={locale}
    />
  )
}
