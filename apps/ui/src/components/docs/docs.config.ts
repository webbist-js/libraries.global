import type { WikiArticleSummary } from "@/lib/strapi-api/content/server"

export const DOCS_REPO_URL =
  "https://github.com/libraries-global/libraries.global"
export const DOCS_VERSION = "v1.0.0"

export type DocsSectionKey =
  | "getting-started"
  | "contributing"
  | "data-api"
  | "design-system"
  | "governance"

export type DocsSectionConfig = {
  key: DocsSectionKey
  title: string
  description: string
  icon: string
  tintBg: string
  tintFg: string
}

/** The fixed docs taxonomy. Wiki articles are mapped in via docsSectionForArticle. */
export const DOCS_SECTIONS: DocsSectionConfig[] = [
  {
    key: "getting-started",
    title: "Getting started",
    description: "What the project is, and how to run it on your own machine.",
    icon: "mdi:code-tags",
    tintBg: "var(--tint-academic-bg)",
    tintFg: "var(--tint-academic-fg)",
  },
  {
    key: "contributing",
    title: "Contributing",
    description:
      "Adding and correcting records, citing sources and sharing photos.",
    icon: "mdi:pencil-outline",
    tintBg: "#F5EEDC",
    tintFg: "#6B5420",
  },
  {
    key: "data-api",
    title: "Data & API",
    description: "Data licence, bulk exports, provenance and the public API.",
    icon: "mdi:database-outline",
    tintBg: "var(--tint-public-bg)",
    tintFg: "var(--tint-public-fg)",
  },
  {
    key: "design-system",
    title: "Design system",
    description: "Tokens and components for building on the platform.",
    icon: "mdi:view-grid-outline",
    tintBg: "var(--tint-national-bg)",
    tintFg: "var(--tint-national-fg)",
  },
  {
    key: "governance",
    title: "Governance",
    description:
      "Who reviews changes, how decisions are made, and the code of conduct.",
    icon: "mdi:account-group-outline",
    tintBg: "var(--tint-special-bg)",
    tintFg: "var(--tint-special-fg)",
  },
]

/**
 * Wiki sections that are generic catch-alls rather than docs topics — they
 * carry no signal for the docs taxonomy, so matching falls through to the
 * article's own title/category.
 */
const GENERIC_WIKI_SECTIONS = new Set(["contributor", "general", "wiki"])

const MATCHERS: { key: DocsSectionKey; pattern: RegExp }[] = [
  { key: "contributing", pattern: /contribut|correction|submission/ },
  { key: "data-api", pattern: /\bdata\b|api|licen[cs]e|export|provenance/ },
  { key: "design-system", pattern: /design|token|component|style/ },
  { key: "governance", pattern: /govern|conduct|steward|review|moderat/ },
  {
    key: "getting-started",
    pattern: /getting|start|guide|setup|install|run|local/,
  },
]

/** Map a wiki article into the docs taxonomy. Title and category signal
 * first; the wiki section only counts when it isn't a generic catch-all.
 * Everything unmatched lands in Getting started. */
export function docsSectionForArticle(
  article: WikiArticleSummary
): DocsSectionKey {
  const sectionSlug = article.section?.slug?.toLowerCase() ?? ""
  const primary = [
    article.title ?? "",
    article.category?.slug ?? "",
    article.category?.name ?? "",
  ]
    .join(" ")
    .toLowerCase()
  const secondary = GENERIC_WIKI_SECTIONS.has(sectionSlug)
    ? ""
    : `${sectionSlug} ${article.section?.name ?? ""}`.toLowerCase()

  for (const { key, pattern } of MATCHERS) {
    if (pattern.test(primary)) return key
  }
  for (const { key, pattern } of MATCHERS) {
    if (secondary && pattern.test(secondary)) return key
  }

  return "getting-started"
}

/** Canonical docs path for a wiki article, under its mapped docs section. */
export function docsArticlePath(article: WikiArticleSummary): string {
  return `/docs/${docsSectionForArticle(article)}/${article.slug ?? ""}`
}

/** Same, but from a MeiliSearch wiki-article hit (flat section/category slugs). */
export function docsPathForSearchHit(hit: {
  documentId: string
  slug: string
  title?: string | null
  section_slug?: string | null
  section_name?: string | null
  category_slug?: string | null
}): string {
  return docsArticlePath({
    documentId: hit.documentId,
    title: hit.title,
    slug: hit.slug,
    section: hit.section_slug
      ? { slug: hit.section_slug, name: hit.section_name ?? null }
      : null,
    category: hit.category_slug ? { slug: hit.category_slug } : null,
  } as WikiArticleSummary)
}

/** Rough reading time from a Strapi dynamic-zone body: walk every string,
 * count words, 200wpm, minimum 1 minute. */
export function readingTimeMinutes(body: unknown): number | null {
  if (body == null) return null
  let words = 0
  const walk = (node: unknown) => {
    if (typeof node === "string") {
      words += node.split(/\s+/).filter(Boolean).length
    } else if (Array.isArray(node)) {
      node.forEach(walk)
    } else if (typeof node === "object" && node !== null) {
      Object.values(node).forEach(walk)
    }
  }
  walk(body)
  if (words === 0) return null

  return Math.max(1, Math.round(words / 200))
}
