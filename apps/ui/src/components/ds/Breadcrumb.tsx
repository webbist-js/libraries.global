import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

export function Breadcrumb({
  items,
}: {
  readonly items: { label: string; href?: string }[]
}) {
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
          key={i}
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          {i > 0 && <span style={{ color: T.ink.ghost }}>/</span>}
          {item.href && i < items.length - 1 ? (
            <GlobalLink
              href={item.href}
              style={{
                color: T.ink.low,
                textDecoration: "none",
                transition: "color 150ms",
              }}
              className="hover:text-[#f4f7ff]"
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
