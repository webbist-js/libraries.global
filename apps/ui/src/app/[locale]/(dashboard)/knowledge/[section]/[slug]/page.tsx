import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import type { Locale } from "next-intl"
import {
  getTranslations as getUiTranslations,
  setRequestLocale,
} from "next-intl/server"

import {
  docsArticlePath,
  homeSectionOf,
  toDocsSections,
} from "@/components/docs/docs.config"
import DocsArticlePage from "@/components/docs/DocsArticlePage"
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
  fetchDocsWikiArticles,
  fetchWikiArticle,
  fetchWikiSections,
} from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

// The requested content language and draft-mode state vary per request.
// CMS reads retain their explicit five-minute cache in BaseStrapiClient.
export const revalidate = 0
export const dynamicParams = true

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; section: string; slug: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}): Promise<Metadata> {
  const { slug, locale } = await params
  const contentLanguage = articleContentLanguage(
    await (searchParams ?? Promise.resolve({}))
  )
  const [res, sectionsRes, tUi, tArticle] = await Promise.all([
    fetchWikiArticle(slug, locale as Locale, contentLanguage),
    fetchWikiSections(locale as Locale),
    getUiTranslations({ locale: locale as Locale, namespace: "ui" }),
    getUiTranslations({ locale: locale as Locale, namespace: "editorial" }),
  ])
  const article = res?.data
  if (!article)
    return { title: tArticle("pageNotFound"), robots: { index: false } }

  const title = article.title ?? tUi("knowledge")

  const metadata = buildMetadata({
    seo: article.seo,
    alternateLocales: [locale],
    title: `${title} / ${tUi("knowledge")}`,
    description:
      article.summary ??
      tArticle("documentationDescription", { title, site: SITE_NAME }),
    // Canonical lives under the article's home section.
    path:
      docsArticlePath(article, toDocsSections(sectionsRes.data)) +
      contentLanguageSuffix(contentLanguage),
    locale,
    type: "article",
    image: formatStrapiMediaUrl(
      article.seo?.metaImage?.url ?? article.heroImage?.url
    ),
    publishedTime: article.publishedAt,
    modifiedTime: article.updatedAt,
    // A default-locale stand-in for a missing translation isn't indexed.
    robots: res?.localeFallback || contentLanguage ? "noindex-follow" : "index",
  })

  return {
    ...metadata,
    alternates: {
      ...metadata.alternates,
      types: {
        "text/markdown":
          localizedPath(
            docsArticlePath(article, toDocsSections(sectionsRes.data)),
            locale
          ) +
          ".md" +
          contentLanguageSuffix(contentLanguage),
      },
    },
  }
}

export default async function DocsArticleRoute({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; section: string; slug: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale: rawLocale, section, slug } = await params
  const contentLanguage = articleContentLanguage(
    await (searchParams ?? Promise.resolve({}))
  )
  const locale = rawLocale as Locale
  setRequestLocale(locale)
  const tUi = await getUiTranslations("ui")
  const tDiscovery = await getUiTranslations("discovery")

  const [articleRes, allRes, sectionsRes] = await Promise.all([
    fetchWikiArticle(slug, locale, contentLanguage),
    fetchDocsWikiArticles(locale),
    fetchWikiSections(locale as Locale),
  ])
  const article = articleRes?.data
  if (!article) notFound()

  // The canonical path lives under the article's home section; any other
  // segment (a renamed section, or `general` for an unfiled article) redirects.
  const sections = toDocsSections(sectionsRes.data)
  const home = homeSectionOf(article, sections)
  if (!home) notFound()
  if (home.slug !== section) {
    permanentRedirect(
      localizedPath(`/knowledge/${home.slug}/${slug}`, locale) +
        contentLanguageSuffix(contentLanguage)
    )
  }

  const url = absoluteUrl(docsArticlePath(article, sections), locale)

  return (
    <>
      <JsonLd
        data={[
          buildArticleSchema({
            type: "TechArticle",
            title: article.title ?? slug,
            description: article.summary,
            url,
            authorName: article.author,
            publishedAt: article.publishedAt,
            updatedAt: article.updatedAt,
            sectionName: home.title,
          }),
          buildBreadcrumbSchema([
            { name: tUi("home"), url: absoluteUrl("", locale) },
            { name: tUi("knowledge"), url: absoluteUrl("knowledge", locale) },
            { name: article.title ?? slug, url },
          ]),
        ]}
      />
      <DocsArticlePage
        contentLocale={
          contentLanguage ??
          (articleRes?.localeFallback ? routing.defaultLocale : locale)
        }
        article={article}
        articles={allRes?.data ?? []}
        locale={locale}
        section={home}
        sections={sections}
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
