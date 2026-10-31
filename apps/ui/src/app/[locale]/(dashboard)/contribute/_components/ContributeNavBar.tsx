"use client"

import { usePathname } from "next/navigation"
import { useTranslations as useUiTranslations } from "next-intl"

import { useOptionalDashboardOverlay } from "@/components/dashboard/DashboardOverlayContext"
import { type SectionTab, SectionTabs } from "@/components/ds"
import { useCapabilities } from "@/lib/access-client"
import { EDITOR_APPLY_HREF, isArticleEditor } from "@/lib/editor-gate"

export const NAV_ITEMS = [
  {
    id: "hub",
    href: "/contribute",
    label: "Hub",
    icon: "mdi:view-dashboard-outline",
  },
  {
    id: "index",
    href: "/contribute/index",
    label: "Index editor",
    icon: "mdi:map-marker-outline",
  },
  {
    id: "knowledge",
    href: "/contribute/knowledge",
    label: "Knowledge editor",
    icon: "mdi:book-open-page-variant-outline",
  },
  {
    id: "submissions",
    href: "/contribute/submissions",
    label: "My submissions",
    icon: "mdi:inbox-outline",
  },
  {
    id: "membership",
    href: "/contribute/membership",
    label: "Membership",
    icon: "mdi:hand-heart-outline",
  },
] as const

type TabId = (typeof NAV_ITEMS)[number]["id"]

/** Sub-routes that belong under a tab without being the tab's own page. */
const SEGMENT_TO_TAB: Record<string, TabId> = {
  index: "index",
  claim: "index",
  correct: "index",
  knowledge: "knowledge",
  submissions: "submissions",
  membership: "membership",
}

export function activeContributeTab(pathname: string): TabId | null {
  const match = /\/contribute(?:\/([^/?#]+))?/.exec(pathname)
  if (!match) return null
  const segment = match[1]
  if (!segment) return "hub"

  return SEGMENT_TO_TAB[segment] ?? null
}

/** The Contribute section's tabs, on the bottom edge of its hero band. */
export function ContributeNavBar() {
  const tUi = useUiTranslations("ui")
  const tNav = useUiTranslations("contributeNav")

  const pathname = usePathname()
  const { has, ready } = useCapabilities()
  // The Knowledge editor is for editors; everyone else gets the role
  // application under the same tab (the editor pages redirect there too).
  const applyForEditor = ready && !isArticleEditor(has)
  const tabs: SectionTab[] = NAV_ITEMS.map((tab) => ({
    ...tab,
    label: tNav(tab.id),
    ...(tab.id === "knowledge" && applyForEditor
      ? { href: EDITOR_APPLY_HREF }
      : {}),
  }))
  const overlay = useOptionalDashboardOverlay()
  if (overlay) return null

  return (
    <SectionTabs
      activeId={activeContributeTab(pathname)}
      label={tUi("contribute")}
      tabs={tabs}
    />
  )
}
