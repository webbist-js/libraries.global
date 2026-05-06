"use client"

import { usePathname } from "next/navigation"

import { StickySubNav } from "@/components/ds"
import { T } from "@/lib/design-tokens"

const TABS = [
  { id: "overview", label: "Overview", path: "" },
  { id: "contributions", label: "Contributions", path: "/contributions" },
  { id: "following", label: "Following", path: "/following" },
  { id: "collections", label: "Collections", path: "/collections" },
  { id: "badges", label: "Badges", path: "/badges" },
  { id: "activity", label: "Activity", path: "/activity" },
] as const

export function ProfileTabNav({
  username,
  profileVisibility,
}: {
  username: string
  profileVisibility: "public" | "limited" | "private"
}) {
  const pathname = usePathname()
  const base = `/profile/${username}`

  function isActive(path: string) {
    if (path === "") return pathname === base || pathname === `${base}/`

    return pathname.startsWith(`${base}${path}`)
  }

  const activeTab = TABS.find((tab) => isActive(tab.path)) ?? TABS[0]
  const activeId = activeTab?.id ?? "overview"

  const tabs = TABS.map((tab) => ({
    id: tab.id,
    label: tab.label,
    href: `${base}${tab.path}`,
  }))

  const visibilityLabel =
    profileVisibility === "private"
      ? "Private"
      : profileVisibility === "limited"
        ? "Limited"
        : "Public"

  const rightSlot = (
    <span
      style={{
        fontFamily: T.font.mono,
        fontSize: "10px",
        letterSpacing: ".18em",
        textTransform: "uppercase",
        color: T.ink.faint,
        whiteSpace: "nowrap",
        paddingLeft: "16px",
      }}
    >
      Profile · {visibilityLabel}
    </span>
  )

  return <StickySubNav tabs={tabs} activeId={activeId} rightSlot={rightSlot} />
}
