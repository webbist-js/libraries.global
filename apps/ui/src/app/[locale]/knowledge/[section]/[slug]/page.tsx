import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import type { Locale } from "next-intl"

import {
  docsArticlePath,
  homeSectionOf,
  toDocsSections,
} from "@/components/docs/docs.config"
import DocsArticlePage from "@/components/docs/DocsArticlePage"
import { JsonLd } from "@/components/seo/JsonLd"
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

export const dynamic = "force-static"
export const revalidate = 300
export const dynamicParams = true

/** Cache articles on demand, including those beyond the Knowledge hub's first page. */
export function generateStaticParams() {
  return []
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; section: string; slug: string }>
}): Promise<Metadata> {
  const { slug, locale } = await params
  const [res, sectionsRes] = await Promise.all([
    fetchWikiArticle(slug, locale as Locale),
    fetchWikiSections(),
  ])
  const article = res?.data
  if (!article) return { title: "Page not found", robots: { index: false } }

  const title = article.title ?? "Knowledge"

  return buildMetadata({
    seo: article.seo,
    alternateLocales: [locale],
    title: `${title} / Knowledge`,
    description:
      article.summary ??
      `${article.title ?? "Documentation"} — ${SITE_NAME} documentation.`,
    // Canonical lives under the article's home section.
    path: docsArticlePath(article, toDocsSections(sectionsRes.data)),
    locale,
    type: "article",
    image: formatStrapiMediaUrl(
      article.seo?.metaImage?.url ?? article.heroImage?.url
    ),
    publishedTime: article.publishedAt,
    modifiedTime: article.updatedAt,
    // A default-locale stand-in for a missing translation isn't indexed.
    robots: res?.localeFallback ? "noindex-follow" : "index",
  })
}

export default async function DocsArticleRoute({
  params,
}: {
  params: Promise<{ locale: string; section: string; slug: string }>
}) {
  const { locale: rawLocale, section, slug } = await params
  const locale = rawLocale as Locale

  const [articleRes, allRes, sectionsRes] = await Promise.all([
    fetchWikiArticle(slug, locale),
    fetchDocsWikiArticles(locale),
    fetchWikiSections(),
  ])
  const article = articleRes?.data
  if (!article) notFound()

  // The canonical path lives under the article's home section; any other
  // segment (a renamed section, or `general` for an unfiled article) redirects.
  const sections = toDocsSections(sectionsRes.data)
  const home = homeSectionOf(article, sections)
  if (!home) notFound()
  if (home.slug !== section) {
    permanentRedirect(localizedPath(`/knowledge/${home.slug}/${slug}`, locale))
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
            { name: "Home", url: absoluteUrl("", locale) },
            { name: "Knowledge", url: absoluteUrl("knowledge", locale) },
            { name: article.title ?? slug, url },
          ]),
        ]}
      />
      <DocsArticlePage
        article={article}
        articles={allRes?.data ?? []}
        locale={locale}
        section={home}
        sections={sections}
        untranslatedLocale={articleRes?.localeFallback ? locale : null}
      />
    </>
  )
}
