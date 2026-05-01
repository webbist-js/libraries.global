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

export function LocationGridBrowser({
  items,
  rankPrefix,
}: {
  readonly items: LocationGridBrowserItem[]
  /** Single-letter rank prefix shown in the top-left of each cell: "C", "R", "A" */
  readonly rankPrefix: string
}) {
  return (
    <div
      style={{
        border: `1px solid ${T.border.line}`,
        borderRadius: "20px",
        overflow: "hidden",
        background: T.bg.surface,
      }}
      className="grid grid-cols-2 lg:grid-cols-4"
    >
      {items.map((item, i) => (
        <GlobalLink
          key={item.slug ?? i}
          href={item.href}
          style={{
            padding: "24px",
            borderRight: `1px solid ${T.border.line}`,
            borderBottom: `1px solid ${T.border.line}`,
            minHeight: "170px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            position: "relative",
            transition: "background 300ms",
          }}
          className="group hover:bg-[rgba(127,223,255,.03)]"
        >
          {/* Rank */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontFamily: T.font.mono,
              fontSize: "10px",
              color: T.ink.faint,
              letterSpacing: ".14em",
            }}
          >
            <span>
              {rankPrefix} · {String(i + 1).padStart(2, "0")}
            </span>
          </div>

          {/* Name + subtitle */}
          <div>
            <h3
              style={{
                fontFamily: T.font.serif,
                fontWeight: 400,
                fontSize: "22px",
                letterSpacing: "-.02em",
                margin: "14px 0 8px",
                lineHeight: "1.1",
                color: T.ink.base,
              }}
            >
              {item.name}
            </h3>
            {item.subtitle ? (
              <p
                style={{
                  color: T.ink.low,
                  fontSize: "12px",
                  lineHeight: "1.55",
                  margin: 0,
                  fontWeight: 300,
                }}
                className="line-clamp-2"
              >
                {item.subtitle}
              </p>
            ) : null}
          </div>

          {/* Arrow */}
          <span
            style={{
              position: "absolute",
              right: "20px",
              bottom: "18px",
              display: "block",
              height: "1px",
              background: T.ink.ghost,
              transition: "width 300ms, background 300ms",
            }}
            className="w-5 group-hover:w-7 group-hover:bg-[#7fdfff]"
          >
            <span
              style={{
                position: "absolute",
                right: 0,
                top: "-3px",
                width: "6px",
                height: "6px",
                borderRight: `1px solid ${T.ink.ghost}`,
                borderTop: `1px solid ${T.ink.ghost}`,
                transform: "rotate(45deg)",
                display: "block",
              }}
              className="group-hover:border-[#7fdfff]"
            />
          </span>
        </GlobalLink>
      ))}
    </div>
  )
}
