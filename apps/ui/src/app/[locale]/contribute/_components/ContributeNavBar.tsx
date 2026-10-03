"use client"

import { usePathname } from "next/navigation"

import { type SectionTab, SectionTabs } from "@/components/ds"
import { useCapabilities } from "@/lib/access-client"

const NAV_ITEMS = [
  {
    id: "hub",
    href: "/contribute",
    label: "Hub",
    icon: "mdi:view-dashboard-outline",
  },
  {
    id: "community",
    href: "/contribute/community",
    label: "Community",
    icon: "mdi:account-group-outline",
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
  community: "community",
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

  // events/ sits in the section but under no tab
  return SEGMENT_TO_TAB[segment] ?? null
}

/** The Contribute section's tabs, on the bottom edge of its hero band. */
export function ContributeNavBar() {
  const pathname = usePathname()
  const { has } = useCapabilities()
  // Moderation sits before Membership, after the contributor's own tabs.
  const tabs: SectionTab[] = [...NAV_ITEMS]
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
