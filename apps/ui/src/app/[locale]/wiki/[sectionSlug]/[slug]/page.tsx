import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { use } from "react"

import WikiArticlePage from "@/components/wiki/WikiArticlePage"
import { isDevelopment } from "@/lib/general-helpers"
import {
  fetchAllWikiArticleSlugs,
  fetchWikiArticle,
  fetchWikiSections,
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
  const result = await fetchAllWikiArticleSlugs(locale as Locale)

  return result.data.map((a) => ({
    sectionSlug: a.section?.slug || "general",
    slug: a.slug,
  }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; sectionSlug: string; slug: string }>
}): Promise<Metadata> {
  const { locale, sectionSlug, slug } = await params
  const data = (await fetchWikiArticle(slug, locale as Locale))?.data
  if (!data) return { title: "Article not found" }

  const title = data.seo?.metaTitle ?? data.title ?? "Article"
  const description =
    data.seo?.metaDescription ??
    data.summary ??
    `Read "${data.title ?? "this article"}" in the libraries knowledge hub.`
  const ogImageUrl = data.seo?.metaImage?.url
    ? formatStrapiMediaUrl(data.seo.metaImage.url)
    : data.heroImage?.url
      ? formatStrapiMediaUrl(data.heroImage.url)
      : undefined
  const canonical = `/wiki/${sectionSlug}/${slug}`

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

export default function WikiArticleRoute(props: {
  params: Promise<{ locale: string; sectionSlug: string; slug: string }>
}) {
  const params = use(props.params)
  const locale = params.locale as Locale
  const slug = params.slug

  const article = use(fetchWikiArticle(slug, locale))?.data ?? null
  const navSections = use(fetchWikiSections(locale))?.data ?? []

  return (
    <WikiArticlePage
      article={article}
      navSections={navSections}
      locale={locale}
    />
  )
}
