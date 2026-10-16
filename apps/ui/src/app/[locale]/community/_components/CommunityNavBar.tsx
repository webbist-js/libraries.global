"use client"

import { usePathname } from "next/navigation"
import { useTranslations as useUiTranslations } from "next-intl"

import { type SectionTab, SectionTabs } from "@/components/ds"

export type CommunityTabCounts = Partial<
  Record<"noticeboard" | "suggestions", number>
>

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
  {
    id: "discussions",
    href: "/community/discussions",
    label: "Discussions",
    icon: "mdi:forum-outline",
  },
  {
    id: "supporters",
    href: "/community/supporters",
    label: "Supporters",
    icon: "mdi:heart-outline",
  },
]

/** Sub-routes that belong under a tab: drive pages sit under the Noticeboard. */
const SEGMENT_TO_TAB: Record<string, string> = {
  drives: "noticeboard",
  propose: "noticeboard",
  leaderboard: "leaderboard",
  suggestions: "suggestions",
  supporters: "supporters",
  discussions: "discussions",
}

export function activeCommunityTab(pathname: string): string | null {
  const match = /\/community(?:\/([^/?#]+))?(?=[/?#]|$)/.exec(pathname)
  if (!match) return null
  const segment = match[1]
  if (!segment) return "noticeboard"

  return SEGMENT_TO_TAB[segment] ?? null
}

/** The tabs with their counts: open drives, open suggestions. Zero shows none. */
export function communityTabs(counts?: CommunityTabCounts): SectionTab[] {
  return COMMUNITY_TABS.map((tab) => {
    const count = counts?.[tab.id as keyof CommunityTabCounts]

    return count && count > 0 ? { ...tab, count } : tab
  })
}

/** The Community section's tabs, on the bottom edge of its hero band. */
export function CommunityNavBar({
  counts,
}: {
  readonly counts?: CommunityTabCounts
}) {
  const tUi = useUiTranslations("ui")
  const tDiscussions = useUiTranslations("discussions")

  const pathname = usePathname() ?? ""

  return (
    <SectionTabs
      activeId={activeCommunityTab(pathname)}
      label={tUi("community")}
      tabs={communityTabs(counts).map((tab) =>
        tab.id === "discussions"
          ? { ...tab, label: tDiscussions("threads") }
          : tab
      )}
    />
  )
}
