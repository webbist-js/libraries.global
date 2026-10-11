"use client"

import { useTranslations as useUiTranslations } from "next-intl"

import { type SectionTab, SectionTabs } from "@/components/ds/SectionTabs"
import { useNotifications } from "@/components/notifications/NotificationProvider"
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
  const tUi = useUiTranslations("ui")

  const pathname = usePathname()
  const { unread } = useNotifications()
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
    tabs.push(
      {
        id: "notifications",
        label: tUi("notifications"),
        href: "/profile/notifications",
        icon: "mdi:bell-outline",
        count: unread || undefined,
      },
      {
        id: "settings",
        label: tUi("settings"),
        href: "/profile/settings",
        icon: "mdi:cog-outline",
      }
    )
  }

  return (
    <SectionTabs
      label={tUi("profile_sections")}
      tabs={tabs}
      activeId={tabs.find((tab) => isActive(tab.href))?.id ?? null}
    />
  )
}
