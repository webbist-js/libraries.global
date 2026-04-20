"use client"

import { Search } from "lucide-react"

import { cn } from "@/lib/styles"

export interface BlogFilterBarProps {
  readonly categories: { name: string; count: number }[]
  readonly activeCategory: string
  readonly onCategoryChange: (category: string) => void
  readonly searchQuery: string
  readonly onSearchChange: (query: string) => void
  readonly sortOrder: string
  readonly onSortChange: (order: string) => void
}

export function BlogFilterBar({
  categories,
  activeCategory,
  onCategoryChange,
  searchQuery,
  onSearchChange,
  sortOrder,
  onSortChange,
}: BlogFilterBarProps) {
  return (
    <div
      className="sticky top-14 z-30 w-full border-b border-white/10 backdrop-blur-md"
      style={{
        background: "rgba(5, 8, 22, 0.8)",
      }}
    >
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6 md:px-10">
        {/* Category Filters */}
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto py-2">
          {categories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => onCategoryChange(cat.name)}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-1.5 font-mono text-[11px] tracking-[0.12em] whitespace-nowrap uppercase transition-all duration-200",
                activeCategory === cat.name
                  ? "bg-white text-[#050816]"
                  : "border border-white/10 text-white/40 hover:text-white/65"
              )}
            >
              {cat.name}
              <span
                className={cn(
                  "opacity-40",
                  activeCategory === cat.name ? "text-[#050816]" : "text-white"
                )}
              >
                {cat.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search & Sort */}
        <div className="ml-8 flex items-center gap-6">
          <div className="relative flex items-center">
            <div
              className="flex h-9 min-w-[240px] items-center gap-3 rounded-full border border-white/10 px-4 transition-colors focus-within:border-white/25"
              style={{ background: "rgba(255,255,255,0.03)" }}
            >
              <Search className="size-3.5 text-white/30" />
              <input
                type="text"
                placeholder="Search the archive..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full bg-transparent font-mono text-[12px] text-white/70 outline-none placeholder:text-white/20"
              />
              <div className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-white/30 uppercase">
                ⌘K
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 whitespace-nowrap">
            <span className="font-mono text-[10px] tracking-[0.2em] text-white/30 uppercase">
              Sort
            </span>
            <select
              value={sortOrder}
              onChange={(e) => onSortChange(e.target.value)}
              className="appearance-none rounded-lg border border-white/10 bg-white/5 px-4 py-1.5 font-mono text-[11px] text-white/65 transition-colors outline-none hover:border-white/20"
              style={{
                backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 10px center",
                backgroundSize: "12px",
                paddingRight: "30px",
              }}
            >
              <option value="newest">Most recent</option>
              <option value="oldest">Oldest</option>
              <option value="title">Title A-Z</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}
