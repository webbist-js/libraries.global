"use client"

import { type SectionTab, SectionTabs } from "@/components/ds/SectionTabs"
import { usePathname } from "@/lib/navigation"

const TABS = [
  {
    id: "overview",
    label: "Overview",
    path: "",
    icon: "mdi:view-grid-outline",
  },
  {
    id: "contributions",
    label: "Contributions",
    path: "/contributions",
    icon: "mdi:pencil-outline",
  },
  {
    id: "following",
    label: "Following",
    path: "/following",
    icon: "mdi:heart-outline",
  },
  {
    id: "recognition",
    label: "Recognition",
    path: "/badges",
    icon: "mdi:medal-outline",
  },
] as const

type ProfileTabId = (typeof TABS)[number]["id"]

/** Profile section tabs, on the bottom edge of the ProfileHero band. */
export function ProfileTabNav({
  username,
  isOwnProfile = false,
  counts,
}: {
  username: string
  isOwnProfile?: boolean
  counts?: Partial<Record<Exclude<ProfileTabId, "overview">, number>>
}) {
  const pathname = usePathname()
  const base = `/profile/${username}`

  function isActive(href: string) {
    if (pathname === href || pathname === `${href}/`) return true

    return href !== base && pathname.startsWith(`${href}/`)
  }

  const tabs: SectionTab[] = TABS.map((tab) => {
    const count = tab.id === "overview" ? undefined : counts?.[tab.id]

    return {
      id: tab.id,
      label: tab.label,
      href: `${base}${tab.path}`,
      icon: tab.icon,
      count: count ? count : undefined,
    }
  })

  if (isOwnProfile) {
    tabs.push({
      id: "settings",
      label: "Settings",
      href: "/profile/settings",
      icon: "mdi:cog-outline",
    })
  }

  return (
    <SectionTabs
      label="Profile sections"
      tabs={tabs}
      activeId={tabs.find((tab) => isActive(tab.href))?.id ?? null}
    />
  )
}
