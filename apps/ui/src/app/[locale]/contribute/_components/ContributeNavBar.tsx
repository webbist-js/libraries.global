"use client"

import { usePathname } from "next/navigation"

import { StickySubNav } from "@/components/ds"

const NAV_ITEMS = [
  { id: "hub", href: "/contribute", label: "Hub" },
  { id: "community", href: "/contribute/community", label: "Community" },
  { id: "add", href: "/contribute/add", label: "Add to the index" },
  { id: "edit", href: "/contribute/edit", label: "Edit the index" },
  {
    id: "submissions",
    href: "/contribute/submissions",
    label: "My submissions",
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
}

function activeTab(pathname: string): string {
  const match = /\/contribute(?:\/([^/?#]+))?/.exec(pathname)
  if (!match) return ""
  const segment = match[1]
  if (!segment) return "hub"

  // docs/, events/ etc. sit in the section but under no tab
  return SEGMENT_TO_TAB[segment] ?? ""
}

export function ContributeNavBar() {
  const pathname = usePathname()

  return <StickySubNav tabs={[...NAV_ITEMS]} activeId={activeTab(pathname)} />
}
