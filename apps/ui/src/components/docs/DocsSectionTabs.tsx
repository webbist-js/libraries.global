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
  query = ""
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
      icon: "mdi:book-open-outline",
      count: sections.reduce((sum, s) => sum + (counts[s.slug] ?? 0), 0),
    },
    ...sections.map((s) => ({
      id: s.slug,
      label: s.title,
      href: href(s.slug),
      icon: s.icon,
      count: counts[s.slug] ?? 0,
    })),
  ]
}

function TabsFromUrl({
  sections,
  counts,
}: {
  readonly sections: readonly DocsSection[]
  readonly counts: DocsSectionCounts
}) {
  const tUi = useUiTranslations("ui")
  const t = useUiTranslations("editorial")

  const params = useSearchParams()
  const active = activeDocsSection(params.get("section"), sections)

  return (
    <SectionTabs
      activeId={active}
      label={tUi("knowledge_sections")}
      scroll={false}
      tabs={tabsFor(sections, counts, t("allSections"), params.toString())}
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
}: {
  readonly sections: readonly DocsSection[]
  readonly counts: DocsSectionCounts
}) {
  const tUi = useUiTranslations("ui")
  const t = useUiTranslations("editorial")

  return (
    <Suspense
      fallback={
        <SectionTabs
          activeId={ALL_SECTIONS}
          label={tUi("knowledge_sections")}
          tabs={tabsFor(sections, counts, t("allSections"))}
        />
      }
    >
      <TabsFromUrl counts={counts} sections={sections} />
    </Suspense>
  )
}
