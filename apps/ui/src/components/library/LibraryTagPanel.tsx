import { Icon } from "@iconify/react"
import type { ReactNode } from "react"

import { homepagePanelClassName } from "@/components/home/homepage.constants"
import { T } from "@/lib/design-tokens"
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
      {/* Header — rule pattern */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "20px",
        }}
      >
        <Icon
          icon={headerIcon}
          className="size-3.5 shrink-0 text-(--t-ink-faint)"
        />
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".22em",
            textTransform: "uppercase",
            color: T.ink.faint,
            flexShrink: 0,
          }}
        >
          {title}
        </span>
        <div style={{ flex: 1, height: "1px", background: T.border.line }} />
        {items.length > 0 ? (
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              color: T.ink.faint,
              flexShrink: 0,
            }}
          >
            {items.length}
          </span>
        ) : null}
      </div>

      {/* Groups */}
      {items.length > 0 ? (
        <div className="space-y-5">
          {Array.from(grouped.entries()).map(([category, groupItems]) => (
            <div key={category}>
              {!isSingleGroup ? (
                <p className="mb-2.5 text-[10px] font-semibold tracking-[0.14em] text-(--t-ink-faint) uppercase">
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
                        "group inline-flex items-center gap-1.5 rounded-full border border-(--t-border-line) bg-(--t-bg-surface) px-3 py-1.5 transition-colors duration-150 hover:border-(--t-border-hi) hover:bg-(--t-bg-deep)",
                        item.summary ? "cursor-default" : ""
                      )}
                    >
                      {iconString ? (
                        <Icon
                          icon={iconString}
                          className="size-3.5 shrink-0 text-(--t-ink-faint) transition-colors duration-150 group-hover:text-(--t-ink-dim)"
                        />
                      ) : null}
                      <span className="text-xs text-(--t-ink-dim) transition-colors duration-150 group-hover:text-(--t-ink-base)">
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
            items.length > 0
              ? "mt-5 border-t border-(--t-border-line) pt-5"
              : ""
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
