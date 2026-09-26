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
    padding: "13px 14px 11px",
    fontFamily: T.font.sans,
    fontSize: "15px",
    fontWeight: active ? 600 : 500,
    color: active ? T.ink.base : T.ink.dim,
    borderTop: "none",
    borderLeft: "none",
    borderRight: "none",
    borderBottom: active
      ? `3px solid ${T.accent.primary}`
      : "3px solid transparent",
    whiteSpace: "nowrap",
    transition: "color 150ms",
    textDecoration: "none",
    background: "none",
    cursor: "pointer",
  }
}

/**
 * Universal sticky sub-navigation bar used beneath hero sections sitewide.
 * v2 underline tabs: sentence-case sans, 3px indigo indicator on the active
 * tab (matches the profile tab nav).
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
      <div className="mx-auto max-w-[1360px] px-4 sm:px-8">
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
