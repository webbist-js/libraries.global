import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LocationGridBrowserItem {
  slug: string
  name: string
  /** Secondary descriptor — capital city, summary, type label, etc. */
  subtitle?: string | null
  href: string
}

// ── Component ─────────────────────────────────────────────────────────────────

/** v2 bordered grid of location cells — white cards, serif names. */
export function LocationGridBrowser({
  items,
  rankPrefix: _rankPrefix,
}: {
  readonly items: LocationGridBrowserItem[]
  /** Retained for API compatibility; the v2 design drops the rank label. */
  readonly rankPrefix?: string
}) {
  return (
    <div
      style={{
        border: `1px solid ${T.border.line}`,
        borderRadius: "20px",
        overflow: "hidden",
        background: T.bg.deep,
      }}
      className="grid grid-cols-2 lg:grid-cols-4"
    >
      {items.map((item, i) => (
        <GlobalLink
          key={item.slug ?? i}
          href={item.href}
          style={{
            padding: "22px 24px",
            borderRight: `1px solid ${T.border.divider}`,
            borderBottom: `1px solid ${T.border.divider}`,
            minHeight: "140px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: "12px",
            transition: "background 200ms",
          }}
          className="group hover:bg-(--t-bg-surface)"
        >
          <div>
            <h3
              style={{
                fontFamily: T.font.serif,
                fontWeight: 500,
                fontSize: "22px",
                letterSpacing: "-.01em",
                margin: 0,
                lineHeight: "1.12",
                color: T.ink.base,
              }}
            >
              {item.name}
            </h3>
            {item.subtitle ? (
              <p
                style={{
                  color: T.ink.dim,
                  fontSize: "14px",
                  lineHeight: "1.5",
                  margin: "6px 0 0",
                }}
                className="line-clamp-2"
              >
                {item.subtitle}
              </p>
            ) : null}
          </div>

          <span
            aria-hidden="true"
            className="self-end text-[15px] opacity-0 transition-opacity group-hover:opacity-100"
            style={{ color: T.accent.primary }}
          >
            →
          </span>
        </GlobalLink>
      ))}
    </div>
  )
}
