import { permanentRedirect } from "next/navigation"
import type { Locale } from "next-intl"

import { docsArticlePath } from "@/components/docs/docs.config"
import { fetchWikiArticle } from "@/lib/strapi-api/content/server"

/** The wiki is deprecated — articles now live under /docs in their mapped
 * docs section. Unknown slugs fall back to the docs landing. */
export default async function WikiArticleRedirect({
  params,
}: {
  params: Promise<{ locale: string; sectionSlug: string; slug: string }>
}) {
  const { locale, slug } = await params
  const article = (await fetchWikiArticle(slug, locale as Locale))?.data

  permanentRedirect(
    article ? `/${locale}${docsArticlePath(article)}` : `/${locale}/docs`
  )
}
