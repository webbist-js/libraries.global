"use client"

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
  return (
    <div className="mx-auto flex w-full max-w-[1360px] flex-wrap items-center gap-2 px-4 pt-2 pb-1 sm:px-8">
      <div
        aria-label="Filter by section"
        className="flex flex-wrap items-center gap-2"
        role="group"
      >
        {categories.map((cat) => {
          const active = cat.name === activeCategory

          return (
            <button
              key={cat.name}
              aria-pressed={active}
              onClick={() => onCategoryChange(cat.name)}
              type="button"
              className="rounded-full border px-4 py-2 text-[14px] font-semibold transition-colors"
              style={
                active
                  ? {
                      background: T.accent.chip,
                      borderColor: T.accent.primary,
                      color: T.accent.primaryHover,
                    }
                  : {
                      background: T.bg.deep,
                      borderColor: T.border.hi,
                      color: T.ink.base,
                    }
              }
            >
              {cat.name}
              {cat.count > 0 ? (
                <span
                  className="font-normal"
                  style={{
                    color: active ? T.accent.primaryHover : T.ink.dim,
                  }}
                >
                  {" · "}
                  {cat.count}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <label className="ml-auto flex items-center gap-2 text-[14px]">
        <span style={{ color: T.ink.dim }}>Sort</span>
        <select
          value={sortOrder}
          onChange={(e) => onSortChange(e.target.value)}
          className="cursor-pointer rounded-[10px] border px-3 py-2 text-[14px] font-medium"
          style={{
            background: T.bg.deep,
            borderColor: T.border.hi,
            color: T.ink.base,
          }}
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="title">Title A–Z</option>
        </select>
      </label>
    </div>
  )
}
