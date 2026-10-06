import { DOCS_SECTIONS, type DocsSectionKey } from "./docs.config"

export type DocsSectionCounts = Partial<Record<DocsSectionKey, number>>

/**
 * The sidebar sections open when an article loads: only the one holding the
 * page being read, so a long tree starts short.
 */
export function openSectionsByDefault(
  tree: Partial<Record<DocsSectionKey, readonly { active: boolean }[]>>
): Set<DocsSectionKey> {
  return new Set(
    DOCS_SECTIONS.filter((s) => (tree[s.key] ?? []).some((p) => p.active)).map(
      (s) => s.key
    )
  )
}

/** The section a ?section= value selects, or "all" for anything unknown. */
export function activeDocsSection(
  value: string | null | undefined
): "all" | DocsSectionKey {
  return DOCS_SECTIONS.find((s) => s.key === value)?.key ?? "all"
}
