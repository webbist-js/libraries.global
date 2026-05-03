"use client"

import { usePathname } from "next/navigation"

import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

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

  function isActive(path: string) {
    const base = `/profile/${username}`
    if (path === "") return pathname === base || pathname === `${base}/`

    return pathname.startsWith(`${base}${path}`)
  }

  return (
    <div
      style={{
        position: "sticky",
        top: "56px",
        zIndex: 30,
        borderBottom: `1px solid ${T.border.line}`,
        borderTop: `1px solid ${T.border.line}`,
        background: "var(--t-header-bg)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      <div className="mx-auto max-w-[1296px] px-6 md:px-10">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0",
            overflowX: "auto",
            scrollbarWidth: "none",
          }}
          className="[&::-webkit-scrollbar]:hidden"
        >
          {TABS.map((tab) => {
            const active = isActive(tab.path)
            const href = `/profile/${username}${tab.path}`

            return (
              <Link
                key={tab.id}
                href={href}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "14px 16px",
                  fontFamily: T.font.mono,
                  fontSize: "10px",
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: active ? T.ink.base : T.ink.faint,
                  borderBottom: active
                    ? `2px solid ${T.accent.aurora}`
                    : "2px solid transparent",
                  whiteSpace: "nowrap",
                  transition: "color 150ms",
                  textDecoration: "none",
                }}
              >
                {tab.label}
              </Link>
            )
          })}

          <div style={{ flex: 1 }} />

          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "9px",
              letterSpacing: ".18em",
              textTransform: "uppercase",
              color: T.ink.faint,
              whiteSpace: "nowrap",
              paddingLeft: "16px",
            }}
          >
            Profile ·{" "}
            {profileVisibility === "private"
              ? "Private"
              : profileVisibility === "limited"
                ? "Limited"
                : "Public"}
          </span>
        </div>
      </div>
    </div>
  )
}
