"use client"

import { usePathname } from "next/navigation"

import { type SectionTab, SectionTabs } from "@/components/ds"
import { useCapabilities } from "@/lib/access-client"
import { EDITOR_APPLY_HREF, isArticleEditor } from "@/lib/editor-gate"

const NAV_ITEMS = [
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

/** Shown only to Moderators (`moderate.queue`); Strapi re-checks every call. */
const MODERATION_TAB = {
  id: "moderation",
  href: "/contribute/moderation",
  label: "Moderation",
  icon: "mdi:shield-check-outline",
} as const

type TabId = (typeof NAV_ITEMS)[number]["id"] | typeof MODERATION_TAB.id

/** Sub-routes that belong under a tab without being the tab's own page. */
const SEGMENT_TO_TAB: Record<string, TabId> = {
  index: "index",
  claim: "index",
  correct: "index",
  knowledge: "knowledge",
  submissions: "submissions",
  membership: "membership",
  moderation: "moderation",
}

export function activeContributeTab(pathname: string): string | null {
  const match = /\/contribute(?:\/([^/?#]+))?/.exec(pathname)
  if (!match) return null
  const segment = match[1]
  if (!segment) return "hub"

  return SEGMENT_TO_TAB[segment] ?? null
}

/** The Contribute section's tabs, on the bottom edge of its hero band. */
export function ContributeNavBar() {
  const pathname = usePathname()
  const { has, ready } = useCapabilities()
  // The Knowledge editor is for editors; everyone else gets the role
  // application under the same tab (the editor pages redirect there too).
  const applyForEditor = ready && !isArticleEditor(has)
  const tabs: SectionTab[] = NAV_ITEMS.map((t) =>
    t.id === "knowledge" && applyForEditor
      ? { ...t, href: EDITOR_APPLY_HREF }
      : t
  )
  // Moderation sits before Membership, after the contributor's own tabs.
  if (has("moderate.queue")) {
    const at = tabs.findIndex((t) => t.id === "membership")
    tabs.splice(at === -1 ? tabs.length : at, 0, MODERATION_TAB)
  }

  return (
    <SectionTabs
      activeId={activeContributeTab(pathname)}
      label="Contribute"
      tabs={tabs}
    />
  )
}
