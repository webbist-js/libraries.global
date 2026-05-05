"use client"

import type React from "react"

import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

export type StickySubNavTab = {
  id: string
  label: string
  /** If provided, the tab renders as a locale-aware Link instead of a button. */
  href?: string
}

export interface StickySubNavProps {
  readonly tabs: StickySubNavTab[]
  /** The id of the currently active tab. */
  readonly activeId: string
  /** Called when a button-style tab is clicked (no href). */
  readonly onTabClick?: (id: string) => void
  /** Optional content rendered flush-right (e.g. entity ref, visibility label). */
  readonly rightSlot?: React.ReactNode
}

const BASE_STYLE: React.CSSProperties = {
  position: "sticky",
  top: "56px",
  zIndex: 30,
  borderBottom: `1px solid ${T.border.line}`,
  borderTop: `1px solid ${T.border.line}`,
  background: "var(--t-header-bg)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "14px 16px",
    fontFamily: T.font.mono,
    fontSize: "10px",
    letterSpacing: ".14em",
    textTransform: "uppercase",
    color: active ? T.ink.base : T.ink.faint,
    borderTop: "none",
    borderLeft: "none",
    borderRight: "none",
    borderBottom: active
      ? `2px solid ${T.accent.aurora}`
      : "2px solid transparent",
    whiteSpace: "nowrap",
    transition: "color 150ms",
    textDecoration: "none",
    background: "none",
    cursor: "pointer",
  }
}

/**
 * Universal sticky sub-navigation bar used beneath hero sections sitewide.
 * Matches the profile page tab nav style: underline indicator, aurora accent,
 * mono font, uppercase.
 *
 * Tabs render as `<Link>` when `href` is provided, otherwise as `<button>`.
 */
export function StickySubNav({
  tabs,
  activeId,
  onTabClick,
  rightSlot,
}: StickySubNavProps) {
  return (
    <div style={BASE_STYLE}>
      <div className="mx-auto max-w-[1296px] px-6 md:px-10">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            overflowX: "auto",
            scrollbarWidth: "none",
          }}
          className="[&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((tab) => {
            const active = activeId === tab.id
            const style = tabStyle(active)

            if (tab.href) {
              return (
                <Link key={tab.id} href={tab.href} style={style}>
                  {tab.label}
                </Link>
              )
            }

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabClick?.(tab.id)}
                style={style}
              >
                {tab.label}
              </button>
            )
          })}

          {rightSlot ? (
            <>
              <div style={{ flex: 1 }} />
              {rightSlot}
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
