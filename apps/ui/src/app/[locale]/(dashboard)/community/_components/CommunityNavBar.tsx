"use client"

import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"

import { type SectionTab, SectionTabs } from "@/components/ds"

export type CommunityTabCounts = Partial<
  Record<"noticeboard" | "suggestions", number>
>

const COMMUNITY_TABS = [
  {
    id: "noticeboard",
    href: "/community",
    icon: "mdi:pin-outline",
  },
  {
    id: "leaderboard",
    href: "/community/leaderboard",
    icon: "mdi:trophy-outline",
  },
  {
    id: "suggestions",
    href: "/community/suggestions",
    icon: "mdi:thumb-up-outline",
  },
  {
    id: "discussions",
    href: "/community/discussions",
    icon: "mdi:forum-outline",
  },
  {
    id: "roadmap",
    href: "/community/roadmap",
    icon: "mdi:map-marker-path",
  },
  {
    id: "supporters",
    href: "/community/supporters",
    icon: "mdi:heart-outline",
  },
] as const

/** Sub-routes that belong under a tab: drive pages sit under the Noticeboard. */
const SEGMENT_TO_TAB: Record<string, string> = {
  drives: "noticeboard",
  propose: "noticeboard",
  leaderboard: "leaderboard",
  suggestions: "suggestions",
  supporters: "supporters",
  discussions: "discussions",
  roadmap: "roadmap",
}

export function activeCommunityTab(pathname: string): string | null {
  const match = /\/community(?:\/([^/?#]+))?(?=[/?#]|$)/.exec(pathname)
  if (!match) return null
  const segment = match[1]
  if (!segment) return "noticeboard"

  return SEGMENT_TO_TAB[segment] ?? null
}

/** The tabs with their counts: open drives, open suggestions. Zero shows none. */
export function communityTabs(
  t: ReturnType<typeof useTranslations<"communityTabs">>,
  counts?: CommunityTabCounts
): SectionTab[] {
  return COMMUNITY_TABS.map((tab) => {
    const count = counts?.[tab.id as keyof CommunityTabCounts]

    return {
      ...tab,
      label: t(tab.id),
      ...(count && count > 0 ? { count } : {}),
    }
  })
}

/** The Community section's tabs, on the bottom edge of its hero band. */
export function CommunityNavBar({
  counts,
}: {
  readonly counts?: CommunityTabCounts
}) {
  const tTabs = useTranslations("communityTabs")
  const tUi = useTranslations("ui")
  const tDiscussions = useTranslations("discussions")

  const pathname = usePathname() ?? ""

  return (
    <SectionTabs
      activeId={activeCommunityTab(pathname)}
      label={tUi("community")}
      tabs={communityTabs(tTabs, counts).map((tab) =>
        tab.id === "discussions"
          ? { ...tab, label: tDiscussions("threads") }
          : tab
      )}
    />
  )
}
