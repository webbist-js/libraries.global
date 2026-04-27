"use client"

import { T } from "@/lib/design-tokens"
import { usePathname, useRouter } from "@/lib/navigation"

const TABS = [
  { label: "Hub", href: "/contribute" },
  { label: "Add Library", href: "/contribute/add" },
  { label: "Edit (Diff)", href: "/contribute/edit" },
  { label: "Wiki Editor", href: "/contribute/wiki" },
  { label: "My Submissions", href: "/contribute/submissions" },
] as const

export function ContributeBottomNav() {
  const pathname = usePathname()
  const router = useRouter()

  function isActive(href: string) {
    if (href === "/contribute") {
      return pathname === "/contribute" || pathname === "/contribute/"
    }

    return pathname.startsWith(href)
  }

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "52px",
        background: "#030511",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        zIndex: 50,
        display: "flex",
        alignItems: "stretch",
      }}
    >
      <div
        className="mx-auto w-full max-w-6xl"
        style={{ display: "flex", alignItems: "stretch" }}
      >
        {TABS.map((tab) => {
          const active = isActive(tab.href)

          return (
            <button
              key={tab.href}
              onClick={() => router.push(tab.href)}
              style={{
                fontFamily: T.font.mono,
                fontSize: "9px",
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: active ? T.accent.aurora : T.ink.faint,
                background: "transparent",
                border: "none",
                borderBottom: active
                  ? `2px solid ${T.accent.aurora}`
                  : "2px solid transparent",
                cursor: "pointer",
                padding: "14px 16px",
                whiteSpace: "nowrap",
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
