import type { Metadata } from "next"
import { notFound } from "next/navigation"
import type { Locale } from "next-intl"

import {
  docsArticlePath,
  DOCS_SECTIONS,
  docsSectionForArticle,
  type DocsSectionKey,
} from "@/components/docs/docs.config"
import DocsArticlePage from "@/components/docs/DocsArticlePage"
import { JsonLd } from "@/components/seo/JsonLd"
import { isDevelopment } from "@/lib/general-helpers"
import { redirect } from "@/lib/navigation"
import { buildArticleSchema, buildBreadcrumbSchema } from "@/lib/seo/json-ld"
import { absoluteUrl, buildMetadata, SITE_NAME } from "@/lib/seo/metadata"
import {
  fetchDocsWikiArticles,
  fetchWikiArticle,
} from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

export const dynamic = "force-static"
export const revalidate = 300
export const dynamicParams = true

const SECTION_KEYS = new Set(DOCS_SECTIONS.map((section) => section.key))

export async function generateStaticParams({
  params: { locale },
}: {
  params: { locale: string }
}) {
  if (isDevelopment()) return []
  const result = await fetchDocsWikiArticles(locale as Locale)

  return (result?.data ?? []).flatMap((article) =>
    article.slug
      ? [{ section: docsSectionForArticle(article), slug: article.slug }]
      : []
  )
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; section: string; slug: string }>
}): Promise<Metadata> {
  const { slug, locale } = await params
  const article = (await fetchWikiArticle(slug, locale as Locale))?.data
  if (!article) return { title: "Page not found", robots: { index: false } }

  const title = article.seo?.metaTitle ?? article.title ?? "Knowledge"

  return buildMetadata({
    title: `${title} / Knowledge`,
    description:
      article.seo?.metaDescription ??
      article.summary ??
      `${article.title ?? "Documentation"} — ${SITE_NAME} documentation.`,
    // Canonical lives under the article's mapped docs section.
    path: docsArticlePath(article),
    locale,
    type: "article",
    image: formatStrapiMediaUrl(
      article.seo?.metaImage?.url ?? article.heroImage?.url
    ),
    publishedTime: article.publishedAt,
    modifiedTime: article.updatedAt,
  })
}

export default async function DocsArticleRoute({
  params,
}: {
  params: Promise<{ locale: string; section: string; slug: string }>
}) {
  const { locale: rawLocale, section, slug } = await params
  const locale = rawLocale as Locale

  const [articleRes, allRes] = await Promise.all([
    fetchWikiArticle(slug, locale),
    fetchDocsWikiArticles(locale),
  ])
  const article = articleRes?.data
  if (!article) notFound()

  // Canonical path lives under the article's mapped docs section.
  const mappedSection = docsSectionForArticle(article)
  if (!SECTION_KEYS.has(section as DocsSectionKey)) notFound()
  if (mappedSection !== section) {
    redirect({ href: `/knowledge/${mappedSection}/${slug}`, locale })
  }

  const url = absoluteUrl(docsArticlePath(article), locale)
  const sectionTitle =
    DOCS_SECTIONS.find((s) => s.key === mappedSection)?.title ?? "Knowledge"

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
            sectionName: sectionTitle,
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
        sectionKey={mappedSection}
      />
    </>
  )
}
