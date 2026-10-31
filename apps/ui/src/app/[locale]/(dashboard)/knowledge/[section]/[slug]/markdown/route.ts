import { isSupportedLocale } from "@repo/shared-data"

import {
  docsArticlePath,
  homeSectionOf,
  toDocsSections,
} from "@/components/docs/docs.config"
import {
  articleContentLanguage,
  contentLanguageSuffix,
} from "@/lib/article-content-language"
import { fetchPublishedKnowledgeArticle } from "@/lib/knowledge-content"
import { renderKnowledgeMarkdown } from "@/lib/knowledge-markdown"
import { localizedPath, publicCanonicalUrl } from "@/lib/seo/metadata"
import { fetchWikiSections } from "@/lib/strapi-api/content/server"

export const revalidate = 0

const headers = {
  "Cache-Control": "no-store",
  "Content-Type": "text/markdown; charset=utf-8",
  "X-Robots-Tag": "noindex, follow",
}

export async function GET(
  request: Request,
  {
    params,
  }: { params: Promise<{ locale: string; section: string; slug: string }> }
) {
  const { locale, section, slug } = await params
  if (!isSupportedLocale(locale))
    return new Response("Knowledge article not found\n", {
      status: 404,
      headers,
    })
  const url = new URL(request.url)
  const contentLanguage = articleContentLanguage({
    contentLang: url.searchParams.get("contentLang") ?? undefined,
  })
  try {
    const [publication, sectionResponse] = await Promise.all([
      fetchPublishedKnowledgeArticle(slug, locale, contentLanguage),
      fetchWikiSections(locale),
    ])
    if (!publication)
      return new Response("Knowledge article not found\n", {
        status: 404,
        headers,
      })
    const sections = toDocsSections(sectionResponse.data)
    const home = homeSectionOf(publication.article, sections)
    if (!home) throw new Error("Knowledge sections are unavailable")
    const path = localizedPath(
      docsArticlePath(publication.article, sections),
      locale
    )
    const suffix = contentLanguageSuffix(contentLanguage)
    if (home.slug !== section)
      return new Response(null, {
        status: 308,
        headers: {
          ...headers,
          Location: new URL(`${path}.md${suffix}`, url).href,
        },
      })
    const canonicalUrl = publicCanonicalUrl(path + suffix)

    return new Response(
      renderKnowledgeMarkdown(publication.article, {
        canonicalUrl,
        locale: publication.locale,
      }),
      {
        headers: {
          ...headers,
          "Content-Language": publication.locale,
          Link: `<${canonicalUrl}>; rel="canonical", <${publicCanonicalUrl("/llms.txt")}>; rel="describedby"`,
        },
      }
    )
  } catch {
    console.error("[knowledge-markdown] published content unavailable")

    return new Response("Knowledge article temporarily unavailable\n", {
      status: 503,
      headers,
    })
  }
}
