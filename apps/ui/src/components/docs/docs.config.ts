import {
  articleReadingMinutes,
  articleSectionKeys,
  articleText,
} from "@repo/shared-data"

import { T } from "@/lib/design-tokens"
import type { WikiSection } from "@/lib/strapi-api/content/server"

export const DOCS_REPO_URL = "https://github.com/webbist-js/libraries.global"
export const DOCS_VERSION = "v1.0.0"

/**
 * A Knowledge section as the pages render it, built from a Strapi Wiki
 * Section by `toDocsSections`. The taxonomy lives in Strapi: adding a
 * section there adds a tab, a card and a sidebar group here.
 */
export type DocsSection = {
  documentId: string
  slug: string
  title: string
  description: string | null
  /** Iconify id from the section's `icon` field; a book when it has none. */
  icon: string
  order: number | null
  tintBg: string
  tintFg: string
}

export const DEFAULT_SECTION_ICON = "mdi:book-open-outline"

/** How many pages a section card lists on the "All sections" view. */
export const SECTION_PREVIEW_SIZE = 4

/**
 * The path segment for an article that has no section, when the sections
 * list isn't to hand. The article route redirects it to the article's
 * section, as the Journal does with its `general` segment.
 */
export const UNFILED_SECTION_SEGMENT = "general"

export type SectionTint = { bg: string; fg: string }

/**
 * Section tints, picked by `order`, so a section's colour is stable without
 * anyone choosing it. Seven pairs: six sections keep distinct colours.
 */
const SECTION_TINTS: readonly SectionTint[] = [
  { bg: "var(--tint-neutral-bg)", fg: "var(--tint-neutral-fg)" },
  { bg: "var(--tint-academic-bg)", fg: "var(--tint-academic-fg)" },
  { bg: T.accent.chip, fg: T.accent.primaryHover },
  { bg: "var(--t-palette-amber-bg)", fg: "var(--t-palette-amber-fg)" },
  { bg: "var(--tint-public-bg)", fg: "var(--tint-public-fg)" },
  { bg: "var(--tint-national-bg)", fg: "var(--tint-national-fg)" },
  { bg: "var(--tint-special-bg)", fg: "var(--tint-special-fg)" },
]

/** The tint pair for a section's `order`; a missing order takes the first. */
export function tintForOrder(order: number | null | undefined): SectionTint {
  const n =
    typeof order === "number" && Number.isFinite(order)
      ? Math.abs(Math.trunc(order))
      : 0

  const tint = SECTION_TINTS[n % SECTION_TINTS.length]!

  return {
    ...tint,
    bg: `color-mix(in srgb, ${tint.bg} 42%, var(--t-bg-surface))`,
  }
}

/** Strapi Wiki Sections as Knowledge sections, in display order. */
export function toDocsSections(
  sections: readonly WikiSection[] | null | undefined
): DocsSection[] {
  return [...(sections ?? [])]
    .filter((s) => Boolean(s.slug) && Boolean(s.name))
    .sort(
      (a, b) =>
        (a.order ?? Number.MAX_SAFE_INTEGER) -
          (b.order ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name)
    )
    .map((s) => {
      const tint = tintForOrder(s.order)

      return {
        documentId: s.documentId,
        slug: s.slug,
        title: s.name,
        description: s.description?.trim() || null,
        icon: s.icon?.trim() || DEFAULT_SECTION_ICON,
        order: s.order ?? null,
        tintBg: tint.bg,
        tintFg: tint.fg,
      }
    })
}

type SectionLike = {
  section?:
    | ({ slug?: string | null } & Partial<Omit<WikiSection, "slug">>)
    | null
  docsSections?: string[] | null
}

/**
 * The section slugs an article is listed under: its home section (the
 * `section` relation) first, then any extra sections the editor tagged in
 * `docsSections`. An article with no relation takes its first tag as home.
 */
export function docsSectionSlugsOf(article: SectionLike): string[] {
  return articleSectionKeys(article)
}

/** The slug of an article's home section, or null when it has none. */
export function homeSectionSlug(article: SectionLike): string | null {
  return docsSectionSlugsOf(article)[0] ?? null
}

/**
 * The section an article is filed under: its home section when that exists,
 * else the first section, so every article is reachable. Null only when
 * there are no sections at all.
 */
export function homeSectionOf<S extends { slug: string }>(
  article: SectionLike,
  sections: readonly S[]
): S | null {
  const home = homeSectionSlug(article)

  return sections.find((s) => s.slug === home) ?? sections[0] ?? null
}

/**
 * Canonical path of a Knowledge article, under its home section. Pass the
 * sections list where it's to hand, so an unfiled article links straight to
 * the first section; without it the path uses `general` and the article
 * route redirects.
 */
export function docsArticlePath(
  article: SectionLike & { slug?: string | null },
  sections?: readonly { slug: string }[]
): string {
  const home = sections
    ? homeSectionOf(article, sections)?.slug
    : homeSectionSlug(article)

  return `/knowledge/${home ?? UNFILED_SECTION_SEGMENT}/${article.slug ?? ""}`
}

/** Same, from a MeiliSearch wiki-article hit (flat section slug). */
export function docsPathForSearchHit(hit: {
  slug: string
  section_slug?: string | null
}): string {
  return `/knowledge/${hit.section_slug ?? UNFILED_SECTION_SEGMENT}/${hit.slug}`
}

/** The same text measure as Journal cards and the article editor. */
export function readingTimeMinutes(body: unknown): number | null {
  return body == null || !articleText(body).trim()
    ? null
    : articleReadingMinutes(body)
}
