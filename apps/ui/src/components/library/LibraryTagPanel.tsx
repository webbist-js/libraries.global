import { Icon } from "@iconify/react"
import type { ReactNode } from "react"

import { homepagePanelClassName } from "@/components/home/homepage.constants"
import { cn } from "@/lib/styles"

// ── Types ─────────────────────────────────────────────────────────────────────

// Shape returned by the @arshiash80/strapi-plugin-iconhub custom field
type IconHubValue = {
  iconData?: string | null // raw SVG path markup
  iconName?: string | null // iconify icon identifier, e.g. "mdi:wheelchair-accessibility"
  width?: number | null
  height?: number | null
  color?: string | null
}

export interface TagItem {
  id: string | number
  name: string
  category?: string | null
  icon?: IconHubValue | null
  summary?: string | null
}

interface LibraryTagPanelProps {
  readonly title: string
  readonly headerIcon: string
  readonly items: TagItem[]
  readonly className?: string
  readonly children?: ReactNode
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupByCategory(items: TagItem[]): Map<string, TagItem[]> {
  const map = new Map<string, TagItem[]>()
  for (const item of items) {
    const key = item.category ?? "Other"
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }

  return map
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LibraryTagPanel({
  title,
  headerIcon,
  items,
  className,
  children,
}: LibraryTagPanelProps) {
  if (!items.length && !children) return null

  const grouped = groupByCategory(items)
  const isSingleGroup = grouped.size === 1

  return (
    <div className={cn(homepagePanelClassName, "p-5 sm:p-6", className)}>
      {/* Header */}
      <div className="mb-5 flex items-center gap-2">
        <Icon icon={headerIcon} className="size-4 text-white/40" />
        <h2 className="text-[11px] font-medium tracking-[0.18em] text-white/40 uppercase">
          {title}
        </h2>
        <span className="ml-auto rounded-full bg-white/6 px-2 py-0.5 text-[10px] text-white/30">
          {items.length}
        </span>
      </div>

      {/* Groups */}
      {items.length > 0 ? (
        <div className="space-y-5">
          {Array.from(grouped.entries()).map(([category, groupItems]) => (
            <div key={category}>
              {!isSingleGroup ? (
                <p className="mb-2.5 text-[10px] font-semibold tracking-[0.14em] text-white/28 uppercase">
                  {category}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {groupItems.map((item) => {
                  const iconString = item.icon?.iconName ?? null

                  return (
                    <div
                      key={item.id}
                      title={item.summary ?? undefined}
                      className={cn(
                        "group inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5 transition-colors duration-150 hover:border-white/14 hover:bg-white/8",
                        item.summary ? "cursor-default" : ""
                      )}
                    >
                      {iconString ? (
                        <Icon
                          icon={iconString}
                          className="size-3.5 shrink-0 text-white/40 transition-colors duration-150 group-hover:text-white/60"
                        />
                      ) : null}
                      <span className="text-xs text-white/65 transition-colors duration-150 group-hover:text-white/80">
                        {item.name}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {children ? (
        <div
          className={cn(
            items.length > 0 ? "mt-5 border-t border-white/6 pt-5" : ""
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}

LibraryTagPanel.displayName = "LibraryTagPanel"

export default LibraryTagPanel
