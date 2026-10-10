import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import type { Locale } from "next-intl"
import { use } from "react"

import BlogArticlePage from "@/components/blog/BlogArticlePage"
import { JsonLd } from "@/components/seo/JsonLd"
import { buildArticleSchema, buildBreadcrumbSchema } from "@/lib/seo/json-ld"
import {
  absoluteUrl,
  buildMetadata,
  localizedPath,
  SITE_NAME,
} from "@/lib/seo/metadata"
import {
  fetchBlogArticle,
  fetchRecentBlogArticles,
} from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

export const dynamic = "force-static"
export const revalidate = 300
export const dynamicParams = true

/** Articles are cached on demand; builds never enumerate the whole Journal. */
export function generateStaticParams() {
  return []
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
  const { locale, slug } = await params
  const res = await fetchBlogArticle(slug, locale as Locale)
  const data = res?.data
  if (!data) return { title: "Article not found", robots: { index: false } }

  const title = data.title ?? "Article"

  return buildMetadata({
    seo: data.seo,
    alternateLocales: [locale],
    title,
    description:
      data.summary ??
      `Read "${data.title ?? "this article"}" in the ${SITE_NAME} Journal.`,
    path: `journal/${articleSection(data, "general")}/${slug}`,
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
    // A default-locale stand-in for a missing translation isn't indexed.
    robots: res?.localeFallback ? "noindex-follow" : "index",
  })
}

export default function BlogArticleRoute(props: {
  params: Promise<{ locale: string; section: string; slug: string }>
}) {
  const { locale: localeStr, section, slug } = use(props.params)
  const locale = localeStr as Locale

  const articleRes = use(fetchBlogArticle(slug, locale))
  const article = articleRes?.data ?? null
  if (!article) notFound()
  const canonicalSection = articleSection(article, "general")
  if (section !== canonicalSection) {
    permanentRedirect(
      localizedPath(`journal/${canonicalSection}/${slug}`, locale)
    )
  }
  const related = use(fetchRecentBlogArticles(locale))?.data ?? []
  const path = `journal/${articleSection(article, "general")}/${slug}`
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
        untranslatedLocale={articleRes?.localeFallback ? locale : null}
      />
    </>
  )
}
