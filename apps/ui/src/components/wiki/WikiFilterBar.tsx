"use client"

import { Search } from "lucide-react"

import { cn } from "@/lib/styles"

export interface WikiFilterBarProps {
  readonly categories: { name: string; slug: string; count: number }[]
  readonly activeCategorySlug: string
  readonly onCategoryChange: (slug: string) => void
  readonly searchQuery: string
  readonly onSearchChange: (query: string) => void
}

export function WikiFilterBar({
  categories,
  activeCategorySlug,
  onCategoryChange,
  searchQuery,
  onSearchChange,
}: WikiFilterBarProps) {
  return (
    <div
      className="sticky top-14 z-30 w-full border-b border-(--t-border-line) backdrop-blur-md"
      style={{
        background: "var(--t-header-bg)",
      }}
    >
      <div className="mx-auto flex min-h-16 max-w-[1400px] flex-col justify-between gap-4 px-6 py-3 md:flex-row md:items-center md:px-8 md:py-0">
        {/* Category Filters */}
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto py-2">
          {categories.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => onCategoryChange(cat.slug)}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-1.5 font-mono text-[11px] tracking-[0.12em] whitespace-nowrap uppercase transition-all duration-200",
                activeCategorySlug === cat.slug
                  ? "bg-(--t-ink-base) text-(--t-bg-void)"
                  : "border border-(--t-border-line) text-(--t-ink-faint) hover:text-(--t-ink-dim)"
              )}
            >
              {cat.name}
              <span
                className={cn(
                  "opacity-40",
                  activeCategorySlug === cat.slug
                    ? "text-(--t-bg-void)"
                    : "text-(--t-ink-base)"
                )}
              >
                {cat.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-6">
          <div className="relative flex items-center">
            <div
              className="flex h-9 w-full min-w-[240px] items-center gap-3 rounded-full border border-(--t-border-line) px-4 transition-colors focus-within:border-(--t-border-hi)"
              style={{ background: "var(--t-bg-deep)" }}
            >
              <Search className="size-3.5 text-(--t-ink-faint)" />
              <input
                type="text"
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full bg-transparent font-mono text-[12px] text-(--t-ink-dim) outline-none placeholder:text-(--t-ink-faint)"
              />
              <div className="rounded border border-(--t-border-line) bg-(--t-bg-surface) px-1.5 py-0.5 font-mono text-[9px] text-(--t-ink-faint) uppercase">
                ⌘K
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
