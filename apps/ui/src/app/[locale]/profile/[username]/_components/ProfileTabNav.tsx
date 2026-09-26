"use client"

import { Icon } from "@iconify/react"
import { usePathname } from "next/navigation"

import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

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

export function ProfileTabNav({
  username,
  counts,
}: {
  username: string
  counts?: { contributions?: number; libraries?: number; recognition?: number }
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

  const countFor = (id: string): number | undefined => {
    if (id === "contributions") return counts?.contributions
    if (id === "libraries") return counts?.libraries
    if (id === "recognition") return counts?.recognition

    return undefined
  }

  return (
    <div
      className="sticky top-14 z-20 border-b"
      style={{
        background: "var(--t-header-bg)",
        backdropFilter: "blur(12px)",
        borderBottomColor: T.border.line,
      }}
    >
      <nav
        aria-label="Profile sections"
        className="no-scrollbar mx-auto flex w-full max-w-[1360px] items-center gap-1 overflow-x-auto px-4 sm:px-8"
      >
        {TABS.map((tab) => {
          const active = isActive(tab.path)
          const count = countFor(tab.id)

          return (
            <Link
              key={tab.id}
              href={`${base}${tab.path}`}
              aria-current={active ? "page" : undefined}
              className="flex shrink-0 items-center gap-2 px-4 pt-3.5 pb-3 text-[16px] transition-colors"
              style={{
                color: active ? T.ink.base : T.ink.dim,
                fontWeight: active ? 700 : 500,
                borderBottom: `3px solid ${active ? T.accent.primary : "transparent"}`,
                textDecoration: "none",
              }}
            >
              <Icon
                icon={tab.icon}
                width={20}
                height={20}
                aria-hidden="true"
                style={{ color: active ? T.ink.base : T.ink.dim }}
              />
              {tab.label}
              {count != null && count > 0 ? (
                <span
                  className="text-[15px] font-medium"
                  style={{ color: T.ink.dim }}
                >
                  {count}
                </span>
              ) : null}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
