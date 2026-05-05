import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { use } from "react"

import BlogLandingPage from "@/components/blog/BlogLandingPage"
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

  const title = data?.seo?.metaTitle ?? "Blog"
  const description =
    data?.seo?.metaDescription ??
    "Explore stories, research, and editorial from the global libraries community."
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
