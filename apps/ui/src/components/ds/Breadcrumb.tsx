"use client"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import { usePathname } from "@/lib/navigation"
import { cn } from "@/lib/styles"

// ── Types ──────────────────────────────────────────────────────────────────────

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbProps {
  /**
   * Explicit items — bypasses auto-detection entirely.
   * Use for special cases where the URL structure doesn't match the hierarchy.
   * The last item is always rendered as the current page (no link).
   */
  items?: BreadcrumbItem[]
  /**
   * Label overrides for auto mode: URL path segment → display label.
   * e.g. { "united-kingdom": "United Kingdom", "british-library": "British Library" }
   * Any segment not in this map is auto-formatted: "some-slug" → "Some Slug".
   */
  labels?: Record<string, string>
  /**
   * Root item prepended before auto-detected path segments (auto mode only).
   * Defaults to { label: "Home", href: "/" }.
   * Pass false to suppress the root prefix entirely.
   */
  root?: { label: string; href: string } | false
  className?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const DEFAULT_ROOT = { label: "Home", href: "/" }

function slugToLabel(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function itemsFromPath(
  pathname: string,
  labels: Record<string, string>,
  root: BreadcrumbProps["root"]
): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean)

  const built: BreadcrumbItem[] = segments.map((seg, i) => ({
    label: labels[seg] ?? slugToLabel(seg),
    // All segments get an href except the last (current page)
    href:
      i < segments.length - 1
        ? "/" + segments.slice(0, i + 1).join("/")
        : undefined,
  }))

  const rootItem = root === false ? null : (root ?? DEFAULT_ROOT)

  return rootItem ? [rootItem, ...built] : built
}

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * Location trail rendered as `<nav aria-label="Breadcrumb"><ol>`. The last
 * item is marked `aria-current="page"`; separators are hidden from AT.
 */
export function Breadcrumb({
  items: explicitItems,
  labels = {},
  root,
  className,
}: BreadcrumbProps) {
  const pathname = usePathname()

  const items = explicitItems ?? itemsFromPath(pathname, labels, root)

  if (items.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol
        className="m-0 flex list-none flex-wrap items-center gap-x-1.5 gap-y-1 p-0 text-[15px]"
        style={{ fontFamily: T.font.sans }}
      >
        {items.map((item, i) => {
          const isLast = i === items.length - 1

          return (
            <li
              key={`${item.href ?? "current"}:${item.label}`}
              className={cn("flex items-center gap-1.5", isLast && "min-w-0")}
            >
              {i > 0 ? (
                <span aria-hidden="true" style={{ color: T.ink.faint }}>
                  /
                </span>
              ) : null}
              {item.href && !isLast ? (
                <GlobalLink
                  href={item.href}
                  className="text-(--t-ink-dim) underline decoration-transparent underline-offset-[3px] transition-colors hover:text-(--t-accent-primary) hover:decoration-current"
                >
                  {item.label}
                </GlobalLink>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={cn(isLast && "truncate")}
                  style={{
                    color: isLast ? T.ink.base : T.ink.dim,
                    fontWeight: isLast ? 500 : undefined,
                  }}
                >
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
