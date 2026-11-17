import type { ArticleBrowseItem } from "@repo/shared-data"

import { docsArticlePath } from "@/components/docs/docs.config"
import { escapeMarkdown } from "@/lib/knowledge-markdown"
import { localizedPath, publicCanonicalUrl } from "@/lib/seo/metadata"

/** A small routing guide. The article catalogue lives under /knowledge/llms.txt. */
export function renderLlmsTxt(): string {
  return `# Libraries Global

> An index and geographic atlas of public, national, academic and other institutional libraries. Records include sources, locations, opening hours and services where those facts have been recorded.

Use Libraries Global to find a library, check its published record or identify the source of a library fact. Search by name or place first, then read the individual record. A listed library may not admit the public. Missing information does not mean a service is unavailable, and an update date is not a verification date. The index links to catalogues but does not provide book holdings or real-time lending availability.

For citations, link to the library's HTML page and retain its source credits and any dataset licence conditions. A Markdown version is available by appending .md to a library page URL. The sitemap lists the full set of public pages; this file deliberately does not list every library.

The versioned API is for programmatic search and record retrieval. It requires a paid API account and a scoped key. This guide does not grant access or permission to redistribute source data.

## Find library records

- [Search libraries](https://libraries.global/libraries): Find a record by name or place, then follow its page link and append .md for the text version.
- [Sitemap](https://libraries.global/sitemap.xml): Discover published library and place pages at index scale.

## Guides and API

- [Knowledge index](https://libraries.global/knowledge/llms.txt): Published guides in Markdown, including data interpretation and contribution guidance.
- [Developer guide](https://libraries.global/developers/llms.txt): Authentication, API limits, scope and request-reference links.
- [OpenAPI description](https://libraries.global/openapi.json): Machine-readable API operations and schemas.

## Optional

- [About Libraries Global](https://libraries.global/about): What the index includes and how records are built.
- [Privacy notice](https://libraries.global/legal/privacy): How the site handles personal data.
`
}

export function renderDevelopersLlmsTxt(): string {
  return `# Libraries Global API

> A versioned API for searching published library records and reading their source credits. Some service, submission and analysis resources are enabled in stages.

Use the API when software needs structured search or record retrieval. Browser sessions are not API credentials. Send an API account key as Authorization: Bearer YOUR_API_KEY. Keys require settled paid coverage and carry selected scopes; a key identifies software, not a person or verified member of library staff. Keep keys on your server.

The machine API currently accepts locale=en. Search results are summaries; fetch the full record for source credits. Preserve attribution and source-specific licence terms. An entityRef is an API identifier, not a public page URL, and can change after a rename or geographic move. Cite the actual library page when one is available.

Service reads, moderated proposals and analysis jobs are enabled in stages. Disabled resources return 404 resource_not_enabled. Proposals do not publish directly. There is no public MCP server, and the site's other APIs are outside this contract.

## Start here

- [Developer portal](https://libraries.global/developers): Account, keys, usage and billing.
- [Request reference](https://libraries.global/developers/reference): Endpoints, parameters and examples.
- [OpenAPI description](https://libraries.global/openapi.json): Schemas, bearer authentication, scopes, limits and errors.
- [Knowledge API guides](https://libraries.global/knowledge/llms.txt): Published access and interpretation guides in Markdown.

## Optional

- [API purchase terms](https://libraries.global/legal/membership): Terms for paid access.
`
}

/** All published Knowledge variants, separate from the short site guide. */
export function renderKnowledgeLlmsTxt(
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

  return `# Libraries Global Knowledge

> Published guides about the library index, its data, contributions and API use. Each link opens the complete article as Markdown.

Article exports identify their HTML source, content language and modification date. Follow the canonical HTML link when citing an article. A contentLang query on a translated page stays after the .md extension.

## Published articles

${lines.join("\n")}

## Optional

- [Site guide](https://libraries.global/llms.txt): When to use the library index and how to find records.
- [Developer guide](https://libraries.global/developers/llms.txt): API authentication and reference links.
`
}
