import { DOCS_SECTIONS, type DocsSectionKey } from "./docs.config"

export type DocsSectionCounts = Partial<Record<DocsSectionKey, number>>

/** The section a ?section= value selects, or "all" for anything unknown. */
export function activeDocsSection(
  value: string | null | undefined
): "all" | DocsSectionKey {
  return DOCS_SECTIONS.find((s) => s.key === value)?.key ?? "all"
}
