"use client"

import type React from "react"

import { StickySubNav } from "@/components/ds"
import { T } from "@/lib/design-tokens"

export interface WikiFilterBarProps {
  readonly categories: { name: string; slug: string; count: number }[]
  readonly activeCategorySlug: string
  readonly onCategoryChange: (slug: string) => void
  readonly searchQuery?: string
  readonly onSearchChange?: (q: string) => void
}

export function WikiFilterBar({
  categories,
  activeCategorySlug,
  onCategoryChange,
  searchQuery = "",
  onSearchChange,
}: WikiFilterBarProps) {
  const tabs = categories.map((cat) => ({
    id: cat.slug,
    label: cat.name,
  }))

  const rightSlot: React.ReactNode = onSearchChange ? (
    <input
      type="text"
      placeholder="Filter…"
      value={searchQuery}
      onChange={(e) => onSearchChange(e.target.value)}
      style={{
        paddingLeft: "12px",
        paddingRight: "10px",
        paddingTop: "5px",
        paddingBottom: "5px",
        borderRadius: "6px",
        border: `1px solid ${T.border.line}`,
        background: "var(--t-bg-surface)",
        color: T.ink.dim,
        fontSize: "10px",
        fontFamily: T.font.mono,
        letterSpacing: ".08em",
        outline: "none",
        width: "140px",
        marginRight: "4px",
        transition: "border-color 150ms",
      }}
      className="focus:border-(--t-border-hi)"
    />
  ) : undefined

  return (
    <StickySubNav
      tabs={tabs}
      activeId={activeCategorySlug}
      onTabClick={onCategoryChange}
      rightSlot={rightSlot}
    />
  )
}
