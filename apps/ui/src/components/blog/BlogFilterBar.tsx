"use client"

import { StickySubNav } from "@/components/ds"
import { T } from "@/lib/design-tokens"

export interface BlogFilterBarProps {
  readonly categories: { name: string; count: number }[]
  readonly activeCategory: string
  readonly onCategoryChange: (category: string) => void
  readonly sortOrder: string
  readonly onSortChange: (order: string) => void
}

export function BlogFilterBar({
  categories,
  activeCategory,
  onCategoryChange,
  sortOrder,
  onSortChange,
}: BlogFilterBarProps) {
  const tabs = categories.map((cat) => ({
    id: cat.name,
    label: cat.name,
  }))

  const rightSlot = (
    <select
      value={sortOrder}
      onChange={(e) => onSortChange(e.target.value)}
      style={{
        fontSize: "10px",
        fontFamily: T.font.mono,
        letterSpacing: ".14em",
        textTransform: "uppercase",
        color: T.ink.faint,
        background: "transparent",
        border: "none",
        outline: "none",
        cursor: "pointer",
        appearance: "none",
        paddingRight: "14px",
        flexShrink: 0,
      }}
      className="[background-image:none]"
    >
      <option
        value="newest"
        style={{ background: "var(--t-bg-deep)", color: T.ink.base }}
      >
        Newest
      </option>
      <option
        value="oldest"
        style={{ background: "var(--t-bg-deep)", color: T.ink.base }}
      >
        Oldest
      </option>
      <option
        value="title"
        style={{ background: "var(--t-bg-deep)", color: T.ink.base }}
      >
        Title A–Z
      </option>
    </select>
  )

  return (
    <StickySubNav
      tabs={tabs}
      activeId={activeCategory}
      onTabClick={onCategoryChange}
      rightSlot={rightSlot}
    />
  )
}
