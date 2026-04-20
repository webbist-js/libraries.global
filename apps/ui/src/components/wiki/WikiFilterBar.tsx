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
      className="sticky top-14 z-30 w-full border-b border-white/10 backdrop-blur-md"
      style={{
        background: "rgba(5, 8, 22, 0.8)",
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
                  ? "bg-white text-[#050816]"
                  : "border border-white/10 text-white/40 hover:text-white/65"
              )}
            >
              {cat.name}
              <span
                className={cn(
                  "opacity-40",
                  activeCategorySlug === cat.slug
                    ? "text-[#050816]"
                    : "text-white"
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
              className="flex h-9 w-full min-w-[240px] items-center gap-3 rounded-full border border-white/10 px-4 transition-colors focus-within:border-white/25"
              style={{ background: "rgba(255,255,255,0.03)" }}
            >
              <Search className="size-3.5 text-white/30" />
              <input
                type="text"
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full bg-transparent font-mono text-[12px] text-white/70 outline-none placeholder:text-white/20"
              />
              <div className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-white/30 uppercase">
                ⌘K
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
