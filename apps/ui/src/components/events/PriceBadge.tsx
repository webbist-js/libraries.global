import { T } from "@/lib/design-tokens"

interface PriceBadgeProps {
  readonly isFree: boolean
  readonly priceMin?: number | null
  readonly priceMax?: number | null
  readonly size?: "xs" | "sm"
}

/** "Free" on the success tint, else the price (or "Ticketed") on a neutral
 * chip. The words carry the meaning; the colour only repeats it. */
export function PriceBadge({
  isFree,
  priceMin,
  priceMax,
  size = "sm",
}: PriceBadgeProps) {
  const label = isFree
    ? "Free"
    : priceMin != null
      ? priceMax != null && priceMax !== priceMin
        ? `£${priceMin}–£${priceMax}`
        : `£${priceMin}`
      : "Ticketed"

  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full font-semibold"
      style={{
        fontSize: size === "xs" ? "12px" : "13px",
        padding: size === "xs" ? "2px 8px" : "3px 10px",
        background: isFree ? "var(--tint-public-bg)" : T.bg.muted,
        color: isFree ? T.accent.ok : T.ink.base,
      }}
    >
      {label}
    </span>
  )
}
