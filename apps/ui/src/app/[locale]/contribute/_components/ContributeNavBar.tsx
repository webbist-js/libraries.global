"use client"
import { usePathname } from "next/navigation"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

const NAV_ITEMS = [
  { href: "/contribute", label: "Hub" },
  { href: "/contribute/community", label: "Community" },
  { href: "/contribute/add", label: "Add Library" },
  { href: "/contribute/edit", label: "Edit" },
  { href: "/contribute/submissions", label: "My Submissions" },
] as const

export function ContributeNavBar() {
  const pathname = usePathname()

  return (
    <nav
      style={{
        borderBottom: `1px solid ${T.border.line}`,
        background: "rgba(3,5,17,0.92)",
        backdropFilter: "blur(12px)",
        position: "sticky",
        top: "56px",
        zIndex: 40,
      }}
    >
      <div
        className="mx-auto w-full max-w-5xl px-6 md:px-10"
        style={{ display: "flex", gap: "0", overflowX: "auto" }}
      >
        {NAV_ITEMS.map(({ href, label }) => {
          const isActive =
            href === "/contribute"
              ? pathname === "/contribute" ||
                pathname === "/en/contribute" ||
                pathname.endsWith("/contribute")
              : pathname.includes(href.slice("/contribute".length))

          return (
            <GlobalLink
              key={href}
              href={href}
              style={{
                fontFamily: T.font.mono,
                fontSize: "9px",
                letterSpacing: ".16em",
                textTransform: "uppercase",
                color: isActive ? T.accent.aurora : T.ink.faint,
                textDecoration: "none",
                padding: "14px 16px",
                whiteSpace: "nowrap",
                transition: "color 150ms",
                borderBottom: isActive
                  ? `2px solid ${T.accent.aurora}`
                  : "2px solid transparent",
              }}
            >
              {label}
            </GlobalLink>
          )
        })}
      </div>
    </nav>
  )
}
