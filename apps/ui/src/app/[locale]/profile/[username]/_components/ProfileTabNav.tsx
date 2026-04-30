"use client"

import { T } from "@/lib/design-tokens"
import { useRouter } from "@/lib/navigation"

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "contributions", label: "Contributions" },
  { id: "following", label: "Following" },
  { id: "collections", label: "Collections" },
  { id: "badges", label: "Badges" },
  { id: "activity", label: "Activity" },
] as const

export function ProfileTabNav({
  username,
  activeTab,
}: {
  username: string
  activeTab: string
}) {
  const router = useRouter()

  return (
    <div
      style={{
        borderBottom: `1px solid ${T.border.line}`,
        background: "#050816",
      }}
    >
      <div className="mx-auto max-w-[1296px] px-6 md:px-10">
        <div style={{ display: "flex", gap: "0", overflowX: "auto" }}>
          {TABS.map((tab) => {
            const active = activeTab === tab.id

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() =>
                  router.push(`/profile/${username}?tab=${tab.id}`)
                }
                style={{
                  padding: "14px 18px",
                  fontFamily: T.font.mono,
                  fontSize: "10px",
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: active ? T.ink.base : T.ink.faint,
                  background: "transparent",
                  border: "none",
                  borderBottom: active
                    ? `2px solid ${T.accent.aurora}`
                    : "2px solid transparent",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "color 150ms",
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
