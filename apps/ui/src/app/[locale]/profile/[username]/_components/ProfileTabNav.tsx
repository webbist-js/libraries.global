"use client"
import { useTranslations } from "next-intl"

import { type SectionTab, SectionTabs } from "@/components/ds/SectionTabs"
import { useNotifications } from "@/components/notifications/NotificationProvider"
import { usePathname } from "@/lib/navigation"

type ProfileTabId = "overview" | "contributions" | "following" | "recognition"

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
  const tStatic = useTranslations("staticUi")

  const TABS = [
    {
      id: "overview",
      label: tStatic("profileRoute.overview"),
      path: "",
      icon: "mdi:view-grid-outline",
    },
    {
      id: "contributions",
      label: tStatic("profileRoute.contributions"),
      path: "/contributions",
      icon: "mdi:pencil-outline",
    },
    {
      id: "following",
      label: tStatic("profileRoute.following"),
      path: "/following",
      icon: "mdi:heart-outline",
    },
    {
      id: "recognition",
      label: tStatic("profileRoute.recognition"),
      path: "/badges",
      icon: "mdi:medal-outline",
    },
  ] as const

  const tUi = useTranslations("ui")

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
      publicProfile: true,
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
        id: "membership",
        label: tUi("membership"),
        href: "/profile/membership",
        icon: "mdi:star-circle-outline",
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
