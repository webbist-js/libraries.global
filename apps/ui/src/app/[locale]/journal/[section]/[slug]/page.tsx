import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import type { Locale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"

import BlogArticlePage from "@/components/blog/BlogArticlePage"
import { JsonLd } from "@/components/seo/JsonLd"
import {
  articleContentLanguage,
  contentLanguageSuffix,
} from "@/lib/article-content-language"
import { languageName } from "@/lib/locale-fallback"
import { routing } from "@/lib/navigation"
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

// The requested content language and draft-mode state vary per request.
// CMS reads retain their explicit five-minute cache in BaseStrapiClient.
export const revalidate = 0
export const dynamicParams = true

function articleSection(
  article: { section?: { slug?: string | null } | null },
  fallback: string
) {
  return article.section?.slug ?? fallback
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; section: string; slug: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}): Promise<Metadata> {
  const { locale, slug } = await params
  const contentLanguage = articleContentLanguage(
    await (searchParams ?? Promise.resolve({}))
  )
  const [res, t] = await Promise.all([
    fetchBlogArticle(slug, locale as Locale, contentLanguage),
    getTranslations({ locale: locale as Locale, namespace: "editorial" }),
  ])
  const data = res?.data
  if (!data) return { title: t("articleNotFound"), robots: { index: false } }

  const title = data.title ?? t("untitled")

  return buildMetadata({
    seo: data.seo,
    alternateLocales: [locale],
    title,
    description:
      data.summary ?? t("journalDescription", { title, site: SITE_NAME }),
    path: `journal/${articleSection(data, "general")}/${slug}${contentLanguageSuffix(contentLanguage)}`,
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
    robots: res?.localeFallback || contentLanguage ? "noindex-follow" : "index",
  })
}

export default async function BlogArticleRoute(props: {
  params: Promise<{ locale: string; section: string; slug: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ locale: localeStr, section, slug }, searchParams] =
    await Promise.all([props.params, props.searchParams ?? Promise.resolve({})])
  const contentLanguage = articleContentLanguage(searchParams)
  const locale = localeStr as Locale
  setRequestLocale(locale)
  const tUi = await getTranslations("ui")
  const tDiscovery = await getTranslations("discovery")

  const articleRes = await fetchBlogArticle(slug, locale, contentLanguage)
  const article = articleRes?.data ?? null
  if (!article) notFound()
  const canonicalSection = articleSection(article, "general")
  if (section !== canonicalSection) {
    permanentRedirect(
      localizedPath(`journal/${canonicalSection}/${slug}`, locale) +
        contentLanguageSuffix(contentLanguage)
    )
  }
  const related =
    (await fetchRecentBlogArticles((contentLanguage ?? locale) as Locale))
      ?.data ?? []
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
            { name: tUi("journal"), url: absoluteUrl("journal", locale) },
            { name: article.title ?? slug, url },
          ]),
        ]}
      />
      <BlogArticlePage
        contentLocale={
          contentLanguage ??
          (articleRes?.localeFallback ? routing.defaultLocale : locale)
        }
        article={article}
        related={related.filter((a) => a.slug !== slug)}
        locale={locale}
        untranslatedLocale={articleRes?.localeFallback ? locale : null}
      />
      {contentLanguage && contentLanguage !== locale ? (
        <p className="mx-auto max-w-4xl px-6 py-4 text-sm">
          {tDiscovery("readingLanguage", {
            language: languageName(contentLanguage, [], locale),
            interface: languageName(locale, [], locale),
          })}
        </p>
      ) : null}
    </>
  )
}
