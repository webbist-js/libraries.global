import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { use } from "react"

import BlogArticlePage from "@/components/blog/BlogArticlePage"
import { isDevelopment } from "@/lib/general-helpers"
import {
  fetchAllBlogArticleSlugs,
  fetchBlogArticle,
  fetchNavbar,
  fetchRecentBlogArticles,
} from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

export const dynamic = "force-static"
export const revalidate = 300
export const dynamicParams = true

export async function generateStaticParams({
  params: { locale },
}: {
  params: { locale: string }
}) {
  if (isDevelopment()) return []
  const result = await fetchAllBlogArticleSlugs(locale as Locale)

  return result.data.map((a) => ({ slug: a.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  const data = (await fetchBlogArticle(slug, locale as Locale))?.data
  if (!data) return { title: "Article not found" }

  const title = data.seo?.metaTitle ?? data.title ?? "Article"
  const description =
    data.seo?.metaDescription ??
    data.summary ??
    `Read "${data.title ?? "this article"}" on the global libraries blog.`
  const ogImageUrl = data.seo?.metaImage?.url
    ? formatStrapiMediaUrl(data.seo.metaImage.url)
    : data.heroImage?.url
      ? formatStrapiMediaUrl(data.heroImage.url)
      : undefined

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      ...(ogImageUrl ? { images: [{ url: ogImageUrl }] } : {}),
    },
  }
}

export default function BlogArticleRoute(props: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const params = use(props.params)
  const locale = params.locale as Locale
  const slug = params.slug

  const article = use(fetchBlogArticle(slug, locale))?.data ?? null
  const related = use(fetchRecentBlogArticles(locale))?.data ?? []
  const navbar = use(fetchNavbar(locale))?.data

  const filteredRelated = related.filter((a) => a.slug !== slug)

  return (
    <BlogArticlePage
      article={article}
      related={filteredRelated}
      navbar={navbar}
      locale={locale}
    />
  )
}
