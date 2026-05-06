import { T } from "@/lib/design-tokens"

interface PriceBadgeProps {
  readonly isFree: boolean
  readonly priceMin?: number | null
  readonly priceMax?: number | null
  readonly size?: "xs" | "sm"
}

export function PriceBadge({
  isFree,
  priceMin,
  priceMax,
  size = "sm",
}: PriceBadgeProps) {
  const fontSize = "10px"
  const padding = size === "xs" ? "2px 6px" : "3px 8px"

  if (isFree) {
    return (
      <span
        style={{
          fontFamily: T.font.mono,
          fontSize,
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: T.accent.ok,
          borderColor: "rgba(142,240,179,0.2)",
          background: "rgba(142,240,179,0.07)",
          border: "1px solid",
          borderRadius: "999px",
          padding,
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        Free
      </span>
    )
  }

  const label =
    priceMin != null
      ? priceMax != null && priceMax !== priceMin
        ? `£${priceMin}–£${priceMax}`
        : `£${priceMin}`
      : "Ticketed"

  return (
    <span
      style={{
        fontFamily: T.font.mono,
        fontSize,
        letterSpacing: ".14em",
        textTransform: "uppercase",
        color: T.accent.ember,
        borderColor: "rgba(255,184,138,0.2)",
        background: "rgba(255,184,138,0.07)",
        border: "1px solid",
        borderRadius: "999px",
        padding,
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      {label}
    </span>
  )
}
