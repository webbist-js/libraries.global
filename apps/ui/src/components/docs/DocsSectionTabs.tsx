"use client"

import { useSearchParams } from "next/navigation"
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
  counts: DocsSectionCounts
): SectionTab[] {
  return [
    {
      id: ALL_SECTIONS,
      label: "All sections",
      href: "/knowledge",
      icon: "mdi:book-open-outline",
      count: sections.reduce((sum, s) => sum + (counts[s.slug] ?? 0), 0),
    },
    ...sections.map((s) => ({
      id: s.slug,
      label: s.title,
      href: `/knowledge?section=${s.slug}`,
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
  const active = activeDocsSection(useSearchParams().get("section"), sections)

  return (
    <SectionTabs
      activeId={active}
      label="Knowledge sections"
      scroll={false}
      tabs={tabsFor(sections, counts)}
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
  return (
    <Suspense
      fallback={
        <SectionTabs
          activeId={ALL_SECTIONS}
          label="Knowledge sections"
          tabs={tabsFor(sections, counts)}
        />
      }
    >
      <TabsFromUrl counts={counts} sections={sections} />
    </Suspense>
  )
}
