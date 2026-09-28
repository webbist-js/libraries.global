"use client"

import { usePathname } from "next/navigation"

import { type SectionTab, SectionTabs } from "@/components/ds/SectionTabs"

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
    id: "libraries",
    label: "Libraries",
    path: "/following",
    icon: "mdi:bank-outline",
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
  counts,
}: {
  username: string
  counts?: Partial<Record<Exclude<ProfileTabId, "overview">, number>>
}) {
  const pathname = usePathname()
  const base = `/profile/${username}`

  function isActive(path: string) {
    if (path === "") {
      return (
        pathname === base ||
        pathname === `${base}/` ||
        pathname.startsWith(`${base}/activity`) ||
        pathname.startsWith(`${base}/collections`)
      )
    }

    return pathname.startsWith(`${base}${path}`)
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

  return (
    <SectionTabs
      label="Profile sections"
      tabs={tabs}
      activeId={TABS.find((tab) => isActive(tab.path))?.id ?? null}
    />
  )
}
