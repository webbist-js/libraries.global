import type { ArticleBrowseItem } from "@repo/shared-data"

import { docsArticlePath } from "@/components/docs/docs.config"
import { escapeMarkdown } from "@/lib/knowledge-markdown"
import { localizedPath, publicCanonicalUrl } from "@/lib/seo/metadata"

const INTRODUCTION = `# Libraries Global

> Libraries Global is an index and geographic atlas of library institutions around the world. It provides library records, source references, opening hours, services and accessibility information where recorded.

The index includes public, national, academic and other institutional libraries. Inclusion does not mean a library admits the general public. Coverage and completeness vary by country and record. The platform links to library catalogues; it does not provide book holdings or real-time lending availability.

Use the versioned Team API for programmatic search and record retrieval. It requires a Team API key belonging to an active Team with active API coverage. Send Authorization: Bearer YOUR_API_KEY. Browser sessions and beta cookies are unnecessary for these API routes. Check the Knowledge access guide for current purchasing availability and restrictions.

The machine API currently accepts locale=en. Search results are summaries; retrieve the full Library record for its source credits. Preserve meta.attribution and sourceRecords.datasetCredit, including source-specific licence and redistribution conditions. Missing information does not establish that a service is unavailable, and updatedAt is not a verification date.

Take entityRef from a search or list response and URL-encode it as one path segment for a detail request. References can change after a rename or geographic move. They are not public page URLs: an Area can appear in an entityRef but is omitted from the page path. Cite the actual Libraries Global page URL when available and retain relevant supporting source URLs.

The documented machine API exposes published public Library data. Date-specific opening hours, Events, a changes feed and facility metadata are proposed resources, not callable versioned endpoints. There is no public MCP server. The website's other APIs are not part of the Team API contract.

The site is in closed beta. Discovery files and public pages follow the site's beta and staging access rules. This guide does not grant access or permission to redistribute source data.

## API description

- [OpenAPI description](https://libraries.global/openapi.json): Request and response schemas for POST /api/v1/search/libraries, GET /api/v1/libraries and GET /api/v1/libraries/{entityRef}; bearer authentication, pagination, limits and errors.

## Knowledge articles

Every link below returns the full published article as Markdown. Each export identifies its HTML source, content language and modification date. Append .md to an article's path to request that representation; keep any contentLang query parameter after the extension.
`

const PLATFORM_LINKS = `## Explore the platform

- [Find libraries](https://libraries.global/libraries): Search and filter library institutions.
- [Atlas](https://libraries.global/map): Explore libraries geographically; analytical tools depend on access and supported datasets.
- [Knowledge](https://libraries.global/knowledge): Platform documentation, API usage, data interpretation and contribution guidance.
- [About Libraries Global](https://libraries.global/about): Scope and geographic coverage of the index.

## Optional

- [Journal](https://libraries.global/journal): Editorial features and community stories about libraries.
- [Terms](https://libraries.global/legal/terms): Platform terms of use.
- [Membership terms](https://libraries.global/legal/membership): Membership and API purchase terms.
`

export function renderLlmsTxt(
  articles: readonly ArticleBrowseItem[],
  sectionsByLocale: ReadonlyMap<string, readonly { slug: string }[]>
): string {
  const lines = articles.map((article) => {
    const sections = sectionsByLocale.get(article.locale)
    if (!sections?.length) throw new Error("Knowledge sections are unavailable")
    const path = localizedPath(
      docsArticlePath(
        {
          ...article,
          docsSections: article.sectionSlugs,
        },
        sections
      ),
      article.locale
    )
    const label = escapeMarkdown(article.title.replaceAll(/\s+/g, " ").trim())
    const summary = article.summary?.replaceAll(/\s+/g, " ").trim()

    return `- [${label} (${article.locale})](${publicCanonicalUrl(`${path}.md`)}): ${summary ? escapeMarkdown(summary) : "Published Knowledge article."}`
  })

  return `${INTRODUCTION}\n${lines.join("\n")}\n\n${PLATFORM_LINKS}`
}
