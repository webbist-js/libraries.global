import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { use } from "react"

import BlogArticlePage from "@/components/blog/BlogArticlePage"
import { isDevelopment } from "@/lib/general-helpers"
import {
  fetchAllBlogArticleSlugs,
  fetchBlogArticle,
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

  return result.data
    .filter((a) => a.slug)
    .map((a) => ({
      section: a.section?.slug ?? "general",
      slug: a.slug as string,
    }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; section: string; slug: string }>
}): Promise<Metadata> {
  const { locale, section, slug } = await params
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
  const canonical = `/blog/${section}/${slug}`

  return {
    title,
    description,
    robots: "index, follow",
    alternates: { canonical },
    openGraph: {
      title,
      description,
      type: "article",
      url: canonical,
      ...(ogImageUrl ? { images: [{ url: ogImageUrl }] } : {}),
      ...((data as any).publishedAt
        ? { publishedTime: (data as any).publishedAt }
        : {}),
      ...((data as any).updatedAt
        ? { modifiedTime: (data as any).updatedAt }
        : {}),
    },
    twitter: {
      card: ogImageUrl ? "summary_large_image" : "summary",
      title,
      description,
      ...(ogImageUrl ? { images: [ogImageUrl] } : {}),
    },
  }
}

export default function BlogArticleRoute(props: {
  params: Promise<{ locale: string; section: string; slug: string }>
}) {
  const { locale: localeStr, slug } = use(props.params)
  const locale = localeStr as Locale

  const article = use(fetchBlogArticle(slug, locale))?.data ?? null
  const related = use(fetchRecentBlogArticles(locale))?.data ?? []

  return (
    <BlogArticlePage
      article={article}
      related={related.filter((a) => a.slug !== slug)}
      locale={locale}
    />
  )
}
