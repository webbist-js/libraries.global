"use client"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import { usePathname } from "@/lib/navigation"

// ── Types ──────────────────────────────────────────────────────────────────────

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbProps {
  /**
   * Explicit items — bypasses auto-detection entirely.
   * Use for special cases where the URL structure doesn't match the hierarchy.
   */
  items?: BreadcrumbItem[]
  /**
   * Label overrides for auto mode: URL path segment → display label.
   * e.g. { "united-kingdom": "United Kingdom", "british-library": "British Library" }
   * Any segment not in this map is auto-formatted: "some-slug" → "Some Slug".
   */
  labels?: Record<string, string>
  /**
   * Root item prepended before auto-detected path segments.
   * Defaults to { label: "Atlas", href: "/" }.
   * Pass false to suppress the root prefix entirely.
   */
  root?: { label: string; href: string } | false
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function slugToLabel(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

// ── Component ──────────────────────────────────────────────────────────────────

export function Breadcrumb({
  items: explicitItems,
  labels = {},
  root,
}: BreadcrumbProps) {
  const pathname = usePathname()

  let items: BreadcrumbItem[]

  if (explicitItems) {
    items = explicitItems
  } else {
    // Build items from the current pathname segments
    const segments = pathname.split("/").filter(Boolean)

    const built: BreadcrumbItem[] = segments.map((seg, i) => ({
      label: labels[seg] ?? slugToLabel(seg),
      // All segments get an href except the last (current page)
      href:
        i < segments.length - 1
          ? "/" + segments.slice(0, i + 1).join("/")
          : undefined,
    }))

    // Prepend root (default: "Atlas" → "/")
    const rootItem =
      root === false ? null : (root ?? { label: "Atlas", href: "/" })

    items = rootItem ? [rootItem, ...built] : built
  }

  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        fontFamily: T.font.mono,
        fontSize: "10.5px",
        letterSpacing: ".14em",
        textTransform: "uppercase",
        flexWrap: "wrap",
      }}
    >
      {items.map((item, i) => (
        <span
          key={`${item.label}-${i}`}
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          {i > 0 && <span style={{ color: T.ink.faint }}>/</span>}
          {item.href && i < items.length - 1 ? (
            <GlobalLink
              href={item.href}
              style={{
                color: T.ink.low,
                textDecoration: "none",
                transition: "color 150ms",
              }}
              className="hover:text-(--t-ink-base)"
            >
              {item.label}
            </GlobalLink>
          ) : (
            <span style={{ color: T.ink.base }}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
