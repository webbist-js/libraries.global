import { SUPPORTED_LOCALES } from "@repo/shared-data"

import { renderLlmsTxt } from "@/lib/agent-discovery"
import { fetchKnowledgeCatalogue } from "@/lib/knowledge-content"
import { fetchWikiSections } from "@/lib/strapi-api/content/server"

export const revalidate = 0

const headers = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-store",
}

export async function GET() {
  try {
    const [articles, ...sections] = await Promise.all([
      fetchKnowledgeCatalogue(),
      ...SUPPORTED_LOCALES.map((locale) => fetchWikiSections(locale)),
    ])
    const sectionsByLocale = new Map(
      SUPPORTED_LOCALES.map((locale, index) => [locale, sections[index]!.data])
    )

    return new Response(renderLlmsTxt(articles, sectionsByLocale), { headers })
  } catch {
    console.error("[agent-discovery] Knowledge catalogue unavailable")

    return new Response("Knowledge catalogue temporarily unavailable\n", {
      status: 503,
      headers,
    })
  }
}
