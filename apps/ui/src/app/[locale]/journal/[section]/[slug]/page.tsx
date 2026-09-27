import type { Metadata } from "next"
import { notFound } from "next/navigation"
import type { Locale } from "next-intl"
import { use } from "react"

import BlogArticlePage from "@/components/blog/BlogArticlePage"
import { JsonLd } from "@/components/seo/JsonLd"
import { isDevelopment } from "@/lib/general-helpers"
import { buildArticleSchema, buildBreadcrumbSchema } from "@/lib/seo/json-ld"
import { absoluteUrl, buildMetadata, SITE_NAME } from "@/lib/seo/metadata"
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

function articleSection(
  article: { section?: { slug?: string | null } | null },
  fallback: string
) {
  return article.section?.slug ?? fallback
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; section: string; slug: string }>
}): Promise<Metadata> {
  const { locale, section, slug } = await params
  const data = (await fetchBlogArticle(slug, locale as Locale))?.data
  if (!data) return { title: "Article not found", robots: { index: false } }

  const title = data.seo?.metaTitle ?? data.title ?? "Article"

  return buildMetadata({
    title,
    description:
      data.seo?.metaDescription ??
      data.summary ??
      `Read "${data.title ?? "this article"}" on the ${SITE_NAME} blog.`,
    path: `blog/${articleSection(data, section)}/${slug}`,
    locale,
    type: "article",
    image: formatStrapiMediaUrl(
      data.seo?.openGraph?.ogImage?.url ??
        data.seo?.metaImage?.url ??
        data.heroImage?.url
    ),
    imageAlt: data.heroImage?.alternativeText ?? data.title,
    publishedTime: data.publishedAt,
    modifiedTime: data.updatedAt,
    authors: data.author ? [data.author] : undefined,
    robots: data.seo?.metaRobots?.replaceAll(" ", "").startsWith("noindex")
      ? "noindex"
      : "index",
  })
}

export default function BlogArticleRoute(props: {
  params: Promise<{ locale: string; section: string; slug: string }>
}) {
  const { locale: localeStr, section, slug } = use(props.params)
  const locale = localeStr as Locale

  const article = use(fetchBlogArticle(slug, locale))?.data ?? null
  if (!article) notFound()
  const related = use(fetchRecentBlogArticles(locale))?.data ?? []
  const path = `blog/${articleSection(article, section)}/${slug}`
  const url = absoluteUrl(path, locale)

  return (
    <>
      <JsonLd
        data={[
          buildArticleSchema({
            type: "BlogPosting",
            title: article.title ?? slug,
            description: article.summary,
            url,
            imageUrl: formatStrapiMediaUrl(article.heroImage?.url),
            authorName: article.author,
            publishedAt: article.publishedAt,
            updatedAt: article.updatedAt,
            sectionName: article.section?.name,
          }),
          buildBreadcrumbSchema([
            { name: "Home", url: absoluteUrl("", locale) },
            { name: "Journal", url: absoluteUrl("journal", locale) },
            { name: article.title ?? slug, url },
          ]),
        ]}
      />
      <BlogArticlePage
        article={article}
        related={related.filter((a) => a.slug !== slug)}
        locale={locale}
      />
    </>
  )
}
