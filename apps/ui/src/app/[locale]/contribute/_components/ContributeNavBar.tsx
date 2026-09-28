"use client"

import { usePathname } from "next/navigation"

import { SectionTabs } from "@/components/ds"

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
    id: "add",
    href: "/contribute/add",
    label: "Add to the index",
    icon: "mdi:map-marker-plus-outline",
  },
  {
    id: "edit",
    href: "/contribute/edit",
    label: "Edit the index",
    icon: "mdi:pencil-outline",
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

/** Sub-routes that belong under a tab without being the tab's own page. */
const SEGMENT_TO_TAB: Record<string, (typeof NAV_ITEMS)[number]["id"]> = {
  community: "community",
  add: "add",
  claim: "add",
  edit: "edit",
  correct: "edit",
  submissions: "submissions",
  membership: "membership",
}

function activeTab(pathname: string): string | null {
  const match = /\/contribute(?:\/([^/?#]+))?/.exec(pathname)
  if (!match) return null
  const segment = match[1]
  if (!segment) return "hub"

  // docs/, events/ etc. sit in the section but under no tab
  return SEGMENT_TO_TAB[segment] ?? null
}

/** The Contribute section's tabs, on the bottom edge of its hero band. */
export function ContributeNavBar() {
  const pathname = usePathname()

  return (
    <SectionTabs
      activeId={activeTab(pathname)}
      label="Contribute"
      tabs={NAV_ITEMS}
    />
  )
}
