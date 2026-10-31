"use client"

import { useSearchParams } from "next/navigation"
import { useTranslations as useUiTranslations } from "next-intl"
import { Suspense } from "react"

import type { DocsSection } from "@/components/docs/docs.config"
import { type SectionTab, SectionTabs } from "@/components/ds/SectionTabs"

import {
  activeDocsSection,
  ALL_SECTIONS,
  type DocsSectionCounts,
} from "./docs-sections"

function tabsFor(
  sections: readonly DocsSection[],
  counts: DocsSectionCounts,
  allSections: string,
  query = "",
  total?: number
): SectionTab[] {
  const href = (section?: string) => {
    const params = new URLSearchParams(query)
    params.delete("page")
    if (section) params.set("section", section)
    else params.delete("section")

    return `/knowledge${params.size ? `?${params}` : ""}`
  }

  return [
    {
      id: ALL_SECTIONS,
      label: allSections,
      href: href(),
      // Guides may appear in multiple sections; their facet counts cannot be summed.
      count: total,
    },
    ...sections.map((s) => ({
      id: s.slug,
      label: s.title,
      href: href(s.slug),
      count: counts[s.slug] ?? 0,
    })),
  ]
}

function TabsFromUrl({
  sections,
  counts,
  total,
  variant,
}: {
  readonly sections: readonly DocsSection[]
  readonly counts: DocsSectionCounts
  readonly total?: number
  readonly variant?: "underline" | "pills"
}) {
  const tUi = useUiTranslations("ui")
  const t = useUiTranslations("editorial")

  const params = useSearchParams()
  const active = activeDocsSection(params.get("section"), sections)

  return (
    <SectionTabs
      variant={variant}
      activeId={active}
      label={tUi("knowledge_sections")}
      scroll={false}
      tabs={tabsFor(
        sections,
        counts,
        t("allSections"),
        params.toString(),
        total
      )}
    />
  )
}

/**
 * The Knowledge landing's section tabs, on the hero's bottom edge. The page
 * is static, so the active section is read from ?section= on the client.
 */
export function DocsSectionTabs({
  sections,
  counts,
  total,
  variant,
}: {
  readonly sections: readonly DocsSection[]
  readonly counts: DocsSectionCounts
  readonly total?: number
  readonly variant?: "underline" | "pills"
}) {
  const tUi = useUiTranslations("ui")
  const t = useUiTranslations("editorial")

  return (
    <Suspense
      fallback={
        <SectionTabs
          variant={variant}
          activeId={ALL_SECTIONS}
          label={tUi("knowledge_sections")}
          tabs={tabsFor(sections, counts, t("allSections"), "", total)}
        />
      }
    >
      <TabsFromUrl
        counts={counts}
        sections={sections}
        total={total}
        variant={variant}
      />
    </Suspense>
  )
}
