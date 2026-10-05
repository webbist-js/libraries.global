"use client"

import { usePathname } from "next/navigation"

import { type SectionTab, SectionTabs } from "@/components/ds"

const COMMUNITY_TABS: readonly SectionTab[] = [
  {
    id: "noticeboard",
    href: "/community",
    label: "Noticeboard",
    icon: "mdi:pin-outline",
  },
  {
    id: "leaderboard",
    href: "/community/leaderboard",
    label: "Leaderboard",
    icon: "mdi:trophy-outline",
  },
  {
    id: "suggestions",
    href: "/community/suggestions",
    label: "Suggestions",
    icon: "mdi:thumb-up-outline",
  },
]

/** Sub-routes that belong under a tab: drive pages sit under the Noticeboard. */
const SEGMENT_TO_TAB: Record<string, string> = {
  drives: "noticeboard",
  propose: "noticeboard",
  leaderboard: "leaderboard",
  suggestions: "suggestions",
}

export function activeCommunityTab(pathname: string): string | null {
  const match = /\/community(?:\/([^/?#]+))?(?=[/?#]|$)/.exec(pathname)
  if (!match) return null
  const segment = match[1]
  if (!segment) return "noticeboard"

  return SEGMENT_TO_TAB[segment] ?? null
}

/** The Community section's tabs, on the bottom edge of its hero band. */
export function CommunityNavBar() {
  const pathname = usePathname() ?? ""

  return (
    <SectionTabs
      activeId={activeCommunityTab(pathname)}
      label="Community"
      tabs={COMMUNITY_TABS}
    />
  )
}
