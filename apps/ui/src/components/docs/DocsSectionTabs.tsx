"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

import { DOCS_SECTIONS } from "@/components/docs/docs.config"
import { type SectionTab, SectionTabs } from "@/components/ds/SectionTabs"

import { activeDocsSection, type DocsSectionCounts } from "./docs-sections"

function tabsFor(counts: DocsSectionCounts): SectionTab[] {
  return [
    {
      id: "all",
      label: "All sections",
      href: "/knowledge",
      icon: "mdi:book-open-outline",
      count: DOCS_SECTIONS.reduce((sum, s) => sum + (counts[s.key] ?? 0), 0),
    },
    ...DOCS_SECTIONS.map((s) => ({
      id: s.key,
      label: s.title,
      href: `/knowledge?section=${s.key}`,
      icon: s.icon,
      count: counts[s.key] ?? 0,
    })),
  ]
}

function TabsFromUrl({ counts }: { readonly counts: DocsSectionCounts }) {
  const active = activeDocsSection(useSearchParams().get("section"))

  return (
    <SectionTabs
      activeId={active}
      label="Knowledge sections"
      scroll={false}
      tabs={tabsFor(counts)}
    />
  )
}

/**
 * The Knowledge landing's section tabs, on the hero's bottom edge. The page
 * is static, so the active section is read from ?section= on the client.
 */
export function DocsSectionTabs({
  counts,
}: {
  readonly counts: DocsSectionCounts
}) {
  return (
    <Suspense
      fallback={
        <SectionTabs
          activeId="all"
          label="Knowledge sections"
          tabs={tabsFor(counts)}
        />
      }
    >
      <TabsFromUrl counts={counts} />
    </Suspense>
  )
}
