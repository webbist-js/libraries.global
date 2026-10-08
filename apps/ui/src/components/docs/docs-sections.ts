import { type DocsSection, SECTION_PREVIEW_SIZE } from "./docs.config"

/** Pages per section, by section slug. */
export type DocsSectionCounts = Record<string, number>

/** The ?section= value that shows every section. */
export const ALL_SECTIONS = "all"

/**
 * The sidebar sections open when an article loads: only the one holding the
 * page being read, so a long tree starts short.
 */
export function openSectionsByDefault(
  tree: Record<string, readonly { active: boolean }[]>
): Set<string> {
  return new Set(
    Object.entries(tree)
      .filter(([, pages]) => pages.some((p) => p.active))
      .map(([slug]) => slug)
  )
}

/** The section slug a ?section= value selects, or "all" for anything unknown. */
export function activeDocsSection(
  value: string | null | undefined,
  sections: readonly Pick<DocsSection, "slug">[]
): string {
  return sections.find((s) => s.slug === value)?.slug ?? ALL_SECTIONS
}

/**
 * The rows a section card lists: every one on the section's own tab, else
 * the first few, with how many the "Show all" link leads to.
 */
export function sectionPreview<R>(
  rows: readonly R[],
  showAll: boolean,
  size = SECTION_PREVIEW_SIZE
): { rows: R[]; hidden: number } {
  if (showAll || rows.length <= size) return { rows: [...rows], hidden: 0 }

  return { rows: rows.slice(0, size), hidden: rows.length - size }
}
